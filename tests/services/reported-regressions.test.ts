import { describe, it, expect, vi } from "vitest";
import { dataset, metadata } from "../fixtures";
import { emptyDiscovery } from "../discovery-fixture";
import {
  preservePrevious,
  mergeDatasets,
  datasetKey,
} from "../../src/services/discovery/identity";
import { discoverySchema } from "../../src/services/discovery/types";
import {
  canonicalEndpoint,
  endpointAllowed,
} from "../../src/services/source-url";
import { requestJson } from "../../src/services/http";
import { getAdapter } from "../../src/services/adapters";
import { parseCsv } from "../../src/services/adapters/files";
import { handleProxyRequest } from "../../src/server/proxy-handler";
import { ProxyError } from "../../src/server/proxy-policy";

const discovered = {
  ...dataset,
  id: "arcgis:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0",
  platform: "arcgis" as const,
  validationStatus: "discovered" as const,
};
describe("reported catalog bugs", () => {
  it("updates moved endpoints by stable ID and keeps unrelated prior descriptors", () => {
    const moved = {
      ...discovered,
      serviceUrl: dataset.serviceUrl!.replace("Parks", "Moved"),
    };
    const unrelated = { ...discovered, id: "unrelated", layerId: 99 };
    const merged = preservePrevious([discovered, unrelated], [moved]);
    expect(merged).toEqual([unrelated, moved]);
    expect(
      discoverySchema.safeParse({ ...emptyDiscovery, datasets: merged })
        .success,
    ).toBe(true);
  });
  it("deduplicates both repeated IDs and aliased endpoints with current descriptors winning", () => {
    const alias = { ...discovered, id: "alias", title: "Current" };
    expect(preservePrevious([discovered], [alias, alias])).toEqual([alias]);
    expect(
      preservePrevious([discovered, { ...discovered, layerId: 1 }], []),
    ).toHaveLength(1);
  });
  it("normalizes only the fixed ArcGIS prefix for identity and allowlists", () => {
    const upper =
      "https://services.arcgis.com/org/ArcGIS/rest/services/MixedCase/FeatureServer";
    const actual =
      "https://arcgis.tampagov.net/ArcGIS/REST/Services/MixedCase/FeatureServer";
    const prefix = "https://arcgis.tampagov.net/arcgis/rest/services/";
    expect(endpointAllowed(actual + "/0", [prefix])).toBe(true);
    expect(canonicalEndpoint(actual)).toBe(prefix + "MixedCase/FeatureServer");
    expect(datasetKey({ ...dataset, serviceUrl: actual })).toBe(
      datasetKey({
        ...dataset,
        serviceUrl: actual.replace(
          "/ArcGIS/REST/Services/",
          "/arcgis/rest/services/",
        ),
      }),
    );
    expect(canonicalEndpoint(upper)).toBe(
      upper.replace("/ArcGIS/", "/arcgis/"),
    );
    expect(endpointAllowed(prefix + "../admin/FeatureServer/0", [prefix])).toBe(
      false,
    );
    expect(
      endpointAllowed(
        "https://arcgis.tampagov.net/arcgis/rest/services-evil/Foo/FeatureServer/0",
        [prefix],
      ),
    ).toBe(false);
  });
  it("keeps the newest successful verification and its matching source timestamp kind", () => {
    const fresh = {
      ...dataset,
      lastVerifiedAt: "2026-11-04T00:00:00.000Z",
      sourceUpdatedAt: "2026-11-03T00:00:00.000Z",
      sourceUpdatedKind: "records" as const,
    };
    const old = {
      ...discovered,
      lastVerifiedAt: "2026-10-01T00:00:00.000Z",
      sourceUpdatedAt: "2026-09-01T00:00:00.000Z",
      sourceUpdatedKind: "portal-item" as const,
    };
    expect(mergeDatasets([fresh], [old])[0]).toMatchObject({
      lastVerifiedAt: fresh.lastVerifiedAt,
      sourceUpdatedAt: fresh.sourceUpdatedAt,
      sourceUpdatedKind: "records",
    });
    expect(mergeDatasets([old], [fresh])[0].lastVerifiedAt).toBe(
      fresh.lastVerifiedAt,
    );
    expect(mergeDatasets([fresh], [discovered])[0].lastVerifiedAt).toBe(
      fresh.lastVerifiedAt,
    );
  });
});
describe("publisher transport security regressions", () => {
  it.each([301, 302, 303, 307, 308])(
    "rejects HTTP %s before reading/following redirect targets",
    async (status) => {
      const cancel = vi.fn();
      vi.mocked(fetch).mockResolvedValue(
        new Response(new ReadableStream({ cancel }), {
          status,
          headers: { Location: "http://127.0.0.1/private" },
        }),
      );
      await expect(
        requestJson("https://publisher.example/layer"),
      ).rejects.toThrow("redirects");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
        redirect: "manual",
        credentials: "omit",
      });
      expect(cancel).toHaveBeenCalled();
    },
  );
  it("rejects opaque browser redirects", async () => {
    const response = new Response(null);
    Object.defineProperty(response, "type", { value: "opaqueredirect" });
    vi.mocked(fetch).mockResolvedValue(response);
    await expect(
      requestJson("https://publisher.example/layer"),
    ).rejects.toThrow("redirects");
  });
  it("cancels oversized publisher streams before JSON parsing and does not retry", async () => {
    const cancel = vi.fn();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(2097153));
          },
          cancel,
        }),
      ),
    );
    await expect(
      requestJson("https://publisher.example/layer"),
    ).rejects.toThrow("safe preview size");
    expect(cancel).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
describe("reported adapter data-loss bugs", () => {
  const ckan = {
    ...dataset,
    platform: "ckan" as const,
    resource: {
      url: "https://data.example.test/resource",
      apiRoot: "https://data.example.test",
      id: "resource",
    },
  };
  const meta = { ...metadata, objectIdField: "_id" };
  function response(records: Record<string, unknown>[], total: number) {
    return Response.json({
      success: true,
      result: { fields: [{ id: "_id", type: "int4" }], records, total },
    });
  }
  it("stops on empty CKAN pages that claim more results", async () => {
    vi.mocked(fetch).mockResolvedValue(response([], 1000));
    await expect(getAdapter(ckan).page(ckan, meta, {})).rejects.toThrow(
      "empty page",
    );
  });
  it.each([
    { records: [{ _id: 1 }] },
    { records: [{ _id: 2 }, { _id: 2 }] },
    { records: [{ Name: "Missing ID" }] },
  ])("rejects repeated or missing IDs %j", async ({ records }) => {
    vi.mocked(fetch).mockResolvedValue(response(records, 1000));
    await expect(
      getAdapter(ckan).page(ckan, meta, {
        offset: 100,
        previousIds: new Set(["1"]),
      }),
    ).rejects.toThrow("record IDs");
  });
  it("accepts new CKAN IDs and a terminal empty page", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response([{ _id: 2 }], 2))
      .mockResolvedValueOnce(response([], 0));
    expect(
      (
        await getAdapter(ckan).page(ckan, meta, {
          offset: 1,
          previousIds: new Set(["1"]),
        })
      ).hasMore,
    ).toBe(false);
    expect((await getAdapter(ckan).page(ckan, meta, {})).records).toEqual([]);
  });
  it("preserves empty-valued CSV records while ignoring physically blank lines", () => {
    expect(parseCsv('Name,Value\r\n"",\r\n\r\nOak,1\r\n,')).toEqual([
      { Name: "", Value: "" },
      { Name: "Oak", Value: "1" },
      { Name: "", Value: "" },
    ]);
    expect(parseCsv('Name\n""\n\n""')).toEqual([{ Name: "" }, { Name: "" }]);
  });
  it("also blocks redirects for file previews", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1" },
      }),
    );
    await expect(
      getAdapter({ ...ckan, platform: "csv" }).inspect({
        ...ckan,
        platform: "csv",
      }),
    ).rejects.toThrow("redirects");
  });
});
describe("fresh proxy resolution and early validation", () => {
  function dependencies() {
    return {
      bundled: [discovered],
      index: vi.fn(async () => ({
        report: {
          ...emptyDiscovery,
          datasets: [
            {
              ...discovered,
              serviceUrl: dataset.serviceUrl!.replace("Parks", "Moved"),
            },
          ],
        },
      })),
      admit: vi.fn(async () => vi.fn(async () => {})),
      forward: vi.fn(
        async (request: Request, datasets: readonly (typeof dataset)[]) =>
          Response.json({ ok: true, id: datasets[0].id, url: request.url }),
      ),
    };
  }
  const request = (params: Record<string, string> = {}, init?: RequestInit) =>
    new Request(
      "https://explorer.example.test/api/arcgis?" +
        new URLSearchParams({
          dataset: discovered.id,
          operation: "metadata",
          ...params,
        }),
      init,
    );
  it("refreshes endpoints for IDs already in the bundle before forwarding", async () => {
    const deps = dependencies();
    const response = await handleProxyRequest(request(), deps);
    expect(response.status).toBe(200);
    expect(deps.forward.mock.calls[0][1][0].serviceUrl).toContain("Moved");
    const release = await deps.admit.mock.results[0].value;
    expect(release).toHaveBeenCalledTimes(1);
  });
  it.each<Record<string, string>>([
    { operation: "applyEdits" },
    { url: "http://127.0.0.1" },
    { operation: "query", resultRecordCount: "101" },
    { operation: "query", where: "1=1; DROP TABLE x" },
  ])(
    "rejects invalid parameters before gate or catalog work %j",
    async (params) => {
      const deps = dependencies();
      expect((await handleProxyRequest(request(params), deps)).status).toBe(
        400,
      );
      expect(deps.index).not.toHaveBeenCalled();
      expect(deps.admit).not.toHaveBeenCalled();
    },
  );
  it.each([
    { method: "POST" },
    { headers: { Origin: "https://hostile.example" } },
  ])("rejects invalid callers early %j", async (init) => {
    const deps = dependencies();
    expect(
      (await handleProxyRequest(request({}, init), deps)).status,
    ).toBeGreaterThanOrEqual(400);
    expect(deps.index).not.toHaveBeenCalled();
    expect(deps.admit).not.toHaveBeenCalled();
  });
  it("returns throttling feedback without loading the index or calling a publisher", async () => {
    const deps = dependencies();
    deps.admit.mockRejectedValue(new ProxyError("Slow down", 429, 12));
    const response = await handleProxyRequest(request(), deps);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(deps.index).not.toHaveBeenCalled();
    expect(deps.forward).not.toHaveBeenCalled();
  });
  it("releases concurrency leases after failures", async () => {
    const deps = dependencies();
    deps.forward.mockRejectedValue(Error("offline"));
    expect((await handleProxyRequest(request(), deps)).status).toBe(504);
    const release = await deps.admit.mock.results[0].value;
    expect(release).toHaveBeenCalled();
  });
});
