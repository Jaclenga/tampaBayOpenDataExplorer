import { describe, it, expect, vi } from "vitest";
import { loadDiscovery } from "../../src/services/load-discovery";
import {
  latestIndex,
  validateIndex,
  indexURL,
} from "../../src/server/discovery-index";
import { emptyDiscovery } from "../discovery-fixture";
import { dataset } from "../fixtures";
import { requestArcGIS } from "../../src/services/arcgis-transport";
import { requestJson } from "../../src/services/http";
import { datasetSchema } from "../../src/types";
describe("resilient discovery loading", () => {
  it("loads the scheduled index", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(emptyDiscovery));
    expect(await loadDiscovery("/", new AbortController().signal)).toEqual({
      report: emptyDiscovery,
      warning: null,
    });
  });
  it("falls back to bundled metadata on network, schema, and endpoint failures", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(Response.json(emptyDiscovery));
    expect(
      (await loadDiscovery("/", new AbortController().signal)).warning,
    ).toContain("bundled");
    vi.mocked(fetch).mockResolvedValue(Response.json({ wrong: "schema" }));
    expect(
      (await loadDiscovery("/", new AbortController().signal)).warning,
    ).toContain("curated");
  });
  it("reports the server fallback and preserves curated access when both requests fail", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(emptyDiscovery, {
        headers: { "X-Catalog-Index": "bundled-fallback" },
      }),
    );
    expect(
      (await loadDiscovery("/", new AbortController().signal)).warning,
    ).toContain("bundled");
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 503 }));
    expect(
      (await loadDiscovery("/", new AbortController().signal)).report.datasets,
    ).toEqual([]);
  });
  it("propagates caller cancellation", async () => {
    const c = new AbortController();
    c.abort();
    await expect(loadDiscovery("/", c.signal)).rejects.toThrow();
  });
});
describe("server metadata index trust boundary", () => {
  it("fetches only the fixed public artifact, with deadline and redirects disabled", async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(emptyDiscovery));
    expect(await latestIndex(undefined, upstream)).toEqual({
      report: emptyDiscovery,
      fallback: false,
    });
    expect(upstream).toHaveBeenCalledWith(
      indexURL,
      expect.objectContaining({ redirect: "error", credentials: "omit" }),
    );
  });
  it("uses a trusted bundled index on failed or invalid upstream responses", async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 404 }));
    expect((await latestIndex(undefined, upstream)).fallback).toBe(true);
    upstream.mockResolvedValue(Response.json({ datasets: [] }));
    expect(
      (await latestIndex(new AbortController().signal, upstream)).fallback,
    ).toBe(true);
  });
  it("rejects unregistered hosts, portal identities, or platform types", () => {
    expect(() =>
      validateIndex({
        ...emptyDiscovery,
        datasets: [
          {
            ...dataset,
            platform: "arcgis",
            validationStatus: "discovered",
            portalId: "city_of_tampa",
          },
        ],
      }),
    ).toThrow("unregistered");
  });
  it("validates required source configuration by platform", () => {
    expect(
      datasetSchema.safeParse({ ...dataset, serviceUrl: null }).success,
    ).toBe(false);
    expect(
      datasetSchema.safeParse({ ...dataset, platform: "json" }).success,
    ).toBe(false);
  });
});
describe("direct-first ArcGIS transport and rate limits", () => {
  const tampa = {
    ...dataset,
    id: "tampa/test",
    serviceUrl:
      "https://arcgis.tampagov.net/arcgis/rest/services/Test/FeatureServer",
  };
  it("falls back to the same-origin registered proxy only on browser network failures", async () => {
    vi.stubGlobal("location", new URL("https://explorer.example.test"));
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError("CORS"))
      .mockResolvedValueOnce(Response.json({ fields: [] }));
    expect(await requestArcGIS(tampa, "metadata", {})).toEqual({ fields: [] });
    const url = new URL(String(vi.mocked(fetch).mock.lastCall![0]));
    expect(url.origin).toBe("https://explorer.example.test");
    expect(url.searchParams.get("dataset")).toBe(tampa.id);
    expect(url.searchParams.has("url")).toBe(false);
  });
  it("does not proxy unrelated hosts or authentication errors", async () => {
    vi.stubGlobal("location", new URL("https://explorer.example.test"));
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("CORS"));
    await expect(requestArcGIS(dataset, "metadata", {})).rejects.toThrow(
      "CORS",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ error: { code: 499, message: "Token required" } }),
    );
    await expect(requestArcGIS(tampa, "metadata", {})).rejects.toThrow("499");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not retry earlier than a long Retry-After header", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("", { status: 429, headers: { "Retry-After": "120" } }),
    );
    await expect(requestJson("https://data.example.test")).rejects.toThrow(
      "429",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
