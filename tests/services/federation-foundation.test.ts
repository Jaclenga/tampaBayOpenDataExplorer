import { describe, expect, it, vi } from "vitest";
import { dataset, metadata, record, layerResponse } from "../fixtures";
import { compileFilter } from "../../src/services/record-filter";
import { getPage, getMetadata } from "../../src/services/arcgis";
import { proxyTarget } from "../../src/server/proxy-policy";
import { handleArcGISProxy } from "../../src/server/arcgis-proxy";
import { endpointAllowed } from "../../src/services/source-url";

const tampa = {
  ...dataset,
  id: "tampa/test",
  serviceUrl:
    "https://arcgis.tampagov.net/arcgis/rest/services/Test/FeatureServer",
};
const request = (params: Record<string, string> = {}) =>
  new Request(
    "https://explorer.example.test/api/arcgis?" +
      new URLSearchParams({ dataset: tampa.id, operation: "query", ...params }),
  );
describe("typed record filters", () => {
  it("escapes string literals and validates fields", () => {
    expect(
      compileFilter(
        { field: "NAME", operator: "eq", value: "O'Brien" },
        metadata.fields,
      ),
    ).toBe("NAME = 'O''Brien'");
    expect(() =>
      compileFilter(
        { field: "NAME; DELETE", operator: "eq", value: "x" },
        metadata.fields,
      ),
    ).toThrow("valid field");
  });
  it("rejects invalid numbers and unsupported contains filters", () => {
    expect(() =>
      compileFilter(
        { field: "OBJECTID", operator: "gt", value: "1 OR 1=1" },
        metadata.fields,
      ),
    ).toThrow("numeric");
    expect(() =>
      compileFilter(
        { field: "NAME", operator: "contains", value: "%" },
        metadata.fields,
      ),
    ).toThrow("wildcard");
    expect(
      compileFilter(
        { field: "OBJECTID", operator: "gte", value: "2" },
        metadata.fields,
      ),
    ).toBe("OBJECTID >= 2");
    expect(
      compileFilter(
        { field: "NAME", operator: "is-null", value: "" },
        metadata.fields,
      ),
    ).toBe("NAME IS NULL");
  });
  it("applies filters to live queries and caps the final preview page", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ features: [record(10000)], exceededTransferLimit: true }),
    );
    const page = await getPage(
      dataset,
      metadata,
      9999,
      undefined,
      undefined,
      undefined,
      { field: "NAME", operator: "eq", value: "Park" },
    );
    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(url.searchParams.get("where")).toBe("NAME = 'Park'");
    expect(page.limit).toBe(1);
  });
  it("keeps live source modification and inspection times distinct", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        ...layerResponse,
        editingInfo: { lastEditDate: 1700000000000 },
      }),
    );
    const result = await getMetadata(dataset);
    expect(result.sourceUpdatedAt).toBe(new Date(1700000000000).toISOString());
    expect(result.inspectedAt).not.toBe(result.sourceUpdatedAt);
  });
});
describe("allowlisted proxy security", () => {
  it.each<Record<string, string>>([
    { url: "http://127.0.0.1/" },
    { token: "secret" },
    { callback: "evil" },
    { operation: "applyEdits" },
    { dataset: "unregistered" },
    { resultRecordCount: "101" },
    { resultOffset: "10000" },
    { where: "1=1; DROP TABLE x" },
    { outFields: "secret" },
  ])("rejects unsupported request %j", (params) =>
    expect(() => proxyTarget(request(params), [tampa])).toThrow(),
  );
  it("rejects methods, cross-origin callers, and redirects", async () => {
    expect(() =>
      proxyTarget(new Request(request().url, { method: "POST" }), [tampa]),
    ).toThrow("GET");
    expect(() =>
      proxyTarget(
        new Request(request().url, {
          headers: { Origin: "https://evil.example" },
        }),
        [tampa],
      ),
    ).toThrow("Cross-origin");
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1" },
      }),
    );
    expect((await handleArcGISProxy(request(), [tampa], upstream)).status).toBe(
      502,
    );
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0][1]?.redirect).toBe("manual");
  });
  it("does not accept private addresses or encoded traversal from a poisoned descriptor", () => {
    for (const url of [
      "https://127.0.0.1/Test/FeatureServer",
      "https://arcgis.tampagov.net.evil.test/arcgis/rest/services/Test/FeatureServer",
      "https://arcgis.tampagov.net/arcgis/rest/services/%252e%252e/Test/FeatureServer",
    ]) {
      expect(() =>
        proxyTarget(request(), [{ ...tampa, serviceUrl: url }]),
      ).toThrow();
    }
    expect(
      endpointAllowed(
        "https://arcgis.tampagov.net/arcgis/admin/config/FeatureServer/0",
        ["https://arcgis.tampagov.net/arcgis/rest/services/"],
      ),
    ).toBe(false);
  });
  it("forwards only bounded JSON queries without client credentials", async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ features: [record(1)] }));
    const result = await handleArcGISProxy(
      request({ resultRecordCount: "1", where: "NAME = 'Park'" }),
      [tampa],
      upstream,
    );
    expect(result.status).toBe(200);
    expect(upstream.mock.calls[0][1]?.credentials).toBe("omit");
    expect(new URL(upstream.mock.calls[0][0] as string).hostname).toBe(
      "arcgis.tampagov.net",
    );
  });
  it("rejects oversized responses and preserves rate-limit headers", async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("x".repeat(2097153)));
    expect((await handleArcGISProxy(request(), [tampa], upstream)).status).toBe(
      413,
    );
    upstream.mockResolvedValue(
      Response.json(
        { error: { code: 429, message: "Slow down" } },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
    const response = await handleArcGISProxy(request(), [tampa], upstream);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});
