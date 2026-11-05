import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCatalog, searchCatalog } from "../src/services/catalog";
import {
  getMetadata,
  getPage,
  normalizeGeometry,
  queryUrl,
  requestJson,
} from "../src/services/arcgis";
import { csv, geojson } from "../src/services/export";
import type { LayerMetadata, Page } from "../src/types";
const raw = JSON.parse(readFileSync("public/catalog.json", "utf8"));
const catalog = parseCatalog(raw);
const d = catalog.datasets[0];
const metadata: LayerMetadata = {
  fields: [{ name: "OID", type: "esriFieldTypeOID" }],
  objectIdField: "OID",
  geometryType: "esriGeometryPoint",
  maxRecordCount: 2,
  pagination: true,
  orderBy: true,
  geojson: false,
  query: true,
};
const mock = (value: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify(value), { status }),
      ),
  );
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("catalog and search", () => {
  it("validates every checked entry and its unique identity", () => {
    expect(catalog.datasets).toHaveLength(52);
    expect(new Set(catalog.datasets.map((d) => d.publisher)).size).toBe(6);
  });
  it("rejects malformed, empty, duplicate and insecure catalog entries", () => {
    for (const datasets of [
      [],
      [d, d],
      [{ ...d, serviceUrl: "http://example.com" }],
      [{ ...d, fields: [{ name: 3 }] }],
    ])
      expect(() => parseCatalog({ ...raw, datasets })).toThrow();
  });
  it("supports fuzzy search and intersecting filters", () => {
    expect(
      searchCatalog(catalog.datasets, {
        query: "parsk",
        publisher: "",
        category: "",
        spatial: "",
      }).length,
    ).toBeGreaterThan(0);
    const result = searchCatalog(catalog.datasets, {
      query: "",
      publisher: d.publisher,
      category: d.category!,
      spatial: "spatial",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (x) =>
          x.publisher === d.publisher &&
          x.category === d.category &&
          x.geometryType !== "none",
      ),
    ).toBe(true);
  });
  it("returns an empty result for unmatched searches", () =>
    expect(
      searchCatalog(catalog.datasets, {
        query: "zzzzzzzzzzzz",
        publisher: "",
        category: "",
        spatial: "",
      }),
    ).toEqual([]));
});
describe("ArcGIS adapter", () => {
  it("encodes query parameters without changing the endpoint", () => {
    const u = new URL(queryUrl(d, { where: "name = 'A&B'", outSR: 4326 }));
    expect(u.pathname.endsWith(`/${d.layerId}/query`)).toBe(true);
    expect(u.searchParams.get("where")).toBe("name = 'A&B'");
  });
  it("reads live capabilities and defensive field metadata", async () => {
    mock({
      fields: metadata.fields,
      maxRecordCount: 25,
      capabilities: "Query",
      advancedQueryCapabilities: {
        supportsPagination: true,
        supportsOrderBy: true,
      },
    });
    expect((await getMetadata(d)).objectIdField).toBe("OID");
  });
  it("uses ordered pages and respects transfer limits and native caps", async () => {
    mock({
      features: [{ attributes: { OID: 3 }, geometry: { x: -82, y: 28 } }],
      spatialReference: { wkid: 4326 },
      exceededTransferLimit: false,
    });
    const page = await getPage(d, metadata, 2);
    expect(page.limit).toBe(2);
    expect(page.hasMore).toBe(false);
    const u = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(u.searchParams.get("resultOffset")).toBe("2");
    expect(u.searchParams.get("orderByFields")).toBe("OID ASC");
    expect(page.geojson?.features[0].geometry?.type).toBe("Point");
  });
  it("constructs WGS84 bounding box queries", async () => {
    mock({ features: [] });
    await getPage(d, metadata, 0, undefined, [-83, 27, -82, 28]);
    const u = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(u.searchParams.get("geometryType")).toBe("esriGeometryEnvelope");
    expect(JSON.parse(u.searchParams.get("geometry")!).xmin).toBe(-83);
  });
  it("handles empty and nonspatial records", async () => {
    mock({ features: [] });
    expect(
      (await getPage(d, { ...metadata, geometryType: null })).geojson,
    ).toBeNull();
    expect((await getPage(d, metadata)).hasMore).toBe(false);
  });
  it("refuses unsupported queries and unsafe pagination", async () => {
    await expect(getPage(d, { ...metadata, query: false })).rejects.toThrow(
      "Query",
    );
    await expect(
      getPage(d, { ...metadata, pagination: false }, 100),
    ).rejects.toThrow("pagination");
    mock({ features: [] });
    expect(
      (await getPage(d, { ...metadata, pagination: false })).warning,
    ).toContain("initial");
  });
  it("rejects duplicate, repeated, oversized, missing and malformed records", async () => {
    for (const body of [
      { features: [{ attributes: { OID: 1 } }, { attributes: { OID: 1 } }] },
      {
        features: [
          { attributes: { OID: 1 } },
          { attributes: { OID: 2 } },
          { attributes: { OID: 3 } },
        ],
      },
      { features: [{ attributes: {} }] },
      { features: [{ attributes: { OID: { bad: true } } }] },
      { features: [], exceededTransferLimit: true },
    ]) {
      mock(body);
      await expect(getPage(d, metadata)).rejects.toThrow();
    }
    mock({ features: [{ attributes: { OID: 1 } }] });
    await expect(
      getPage(d, metadata, 2, undefined, undefined, new Set(["1"])),
    ).rejects.toThrow("repeated");
  });
  it("keeps records with an explicit warning when CRS conversion fails", async () => {
    mock({
      features: [{ attributes: { OID: 1 }, geometry: { x: 10, y: 10 } }],
      spatialReference: { wkid: 3857 },
    });
    const p = await getPage(d, metadata);
    expect(p.records).toHaveLength(1);
    expect(p.geojson).toBeNull();
    expect(p.warning).toContain("WGS84");
  });
  it("does not retry permanent errors; reports CORS/network errors", async () => {
    mock({ error: { code: 400, message: "Invalid query" } });
    await expect(requestJson("https://example.org")).rejects.toThrow("400");
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(requestJson("https://example.org")).rejects.toThrow("CORS");
  });
  it("retries transient errors at most twice", async () => {
    vi.useFakeTimers();
    mock({}, 503);
    const result = expect(requestJson("https://example.org")).rejects.toThrow(
      "503",
    );
    await vi.runAllTimersAsync();
    await result;
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("reports request timeouts", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")),
    );
    const result = expect(
      requestJson("https://example.org", undefined, 1),
    ).rejects.toThrow("timed out");
    await vi.runAllTimersAsync();
    await result;
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("does not retry user cancellation", async () => {
    const c = new AbortController();
    c.abort();
    mock({});
    await expect(
      requestJson("https://example.org", c.signal),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
describe("geometry and exports", () => {
  it("handles points, multipoints, lines, polygons and null geometry", () => {
    const geometries = [
      { x: -82, y: 28 },
      {
        points: [
          [-82, 28],
          [-82, 29],
        ],
      },
      {
        paths: [
          [
            [-82, 28],
            [-82, 29],
          ],
        ],
      },
      {
        rings: [
          [
            [-82, 28],
            [-82, 29],
            [-81, 29],
            [-82, 28],
          ],
        ],
      },
      null,
    ];
    const fc = normalizeGeometry(
      geometries.map((geometry) => ({ attributes: {}, geometry })),
      true,
      { wkid: 4326 },
    );
    expect(fc?.features.map((f) => f.geometry?.type ?? null)).toEqual([
      "Point",
      "MultiPoint",
      "LineString",
      "Polygon",
      null,
    ]);
  });
  it("rejects projected and invalid coordinates", () => {
    expect(() =>
      normalizeGeometry(
        [{ attributes: {}, geometry: { x: 1000, y: 1000 } }],
        true,
      ),
    ).toThrow();
    expect(() => normalizeGeometry([], true, { wkid: 3857 })).toThrow();
  });
  it("escapes CSV quotes, commas and newlines and neutralizes spreadsheet formulas", () => {
    const value = csv(
      [{ attributes: { a: '"Hi",\nfriend', b: "=SUM(1,2)", c: null } }],
      [{ name: "a", type: "string" }],
    );
    expect(value).toContain('""Hi"",\nfriend');
    expect(value).toContain("'=SUM(1,2)");
    expect(value.startsWith("\uFEFF")).toBe(true);
  });
  it("exports page GeoJSON and refuses unavailable geometry", () => {
    const p: Page = {
      records: [],
      geojson: { type: "FeatureCollection", features: [] },
      hasMore: false,
      offset: 0,
      limit: 100,
      warning: null,
    };
    expect(JSON.parse(geojson(p)).type).toBe("FeatureCollection");
    expect(() => geojson({ ...p, geojson: null })).toThrow();
    expect(csv([], metadata.fields)).toContain("OID");
  });
});
