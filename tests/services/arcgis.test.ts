import { describe, expect, it, vi } from "vitest";
import {
  getMetadata,
  getPage,
  normalizeGeometry,
} from "../../src/services/arcgis";
import { dataset, fields, layerResponse, metadata, record } from "../fixtures";

const respond = (body: unknown) =>
  vi.mocked(fetch).mockImplementation(async () => Response.json(body));
describe("live ArcGIS capability parsing", () => {
  it("falls back to the advertised OID field and safe nonspatial defaults", async () => {
    respond({ fields });
    const result = await getMetadata(dataset);
    expect(result).toMatchObject({
      objectIdField: "OBJECTID",
      geometryType: null,
      maxRecordCount: 100,
      pagination: false,
      orderBy: false,
      geojson: false,
    });
  });
  it("supports objectIdFieldName and case-insensitive Query capabilities", async () => {
    respond({
      ...layerResponse,
      objectIdField: undefined,
      objectIdFieldName: "NAME",
      capabilities: "Extract, qUeRy",
    });
    expect(await getMetadata(dataset)).toMatchObject({
      objectIdField: "NAME",
      query: true,
    });
  });
  it("does not invent an OID for a table without one", async () => {
    respond({ fields: [{ name: "NAME", type: "esriFieldTypeString" }] });
    expect((await getMetadata(dataset)).objectIdField).toBeNull();
  });
  it.each([
    { fields: "bad" },
    { fields: [{ name: 42 }] },
    { fields, maxRecordCount: 0 },
  ])("rejects malformed metadata %j", async (body) => {
    respond(body);
    await expect(getMetadata(dataset)).rejects.toThrow(
      "unsupported layer schema",
    );
  });
});
describe("bounded page validation", () => {
  it("rejects equivalent numeric and string IDs on the same page", async () => {
    respond({
      features: [record(1), { ...record(1), attributes: { OBJECTID: "1" } }],
    });
    await expect(getPage(dataset, metadata)).rejects.toThrow(
      "repeated record IDs",
    );
  });
  it("preserves distinct string IDs while comparing earlier page IDs consistently", async () => {
    respond({
      features: [
        { attributes: { OBJECTID: "park-1" } },
        { attributes: { OBJECTID: "park-2" } },
      ],
    });
    expect(
      (await getPage(dataset, { ...metadata, geometryType: null })).records,
    ).toHaveLength(2);
    respond({ features: [{ attributes: { OBJECTID: "1" } }] });
    await expect(
      getPage(dataset, metadata, 2, undefined, undefined, new Set(["1"])),
    ).rejects.toThrow("repeated record IDs");
  });
  it.each([-1, 0.5, Infinity, NaN])(
    "rejects invalid offset %s before requesting records",
    async (offset) => {
      await expect(getPage(dataset, metadata, offset)).rejects.toThrow(
        "offset",
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it.each([{ pagination: false }, { orderBy: false }, { objectIdField: null }])(
    "disables unsafe continuation for %j",
    async (change) => {
      await expect(
        getPage(dataset, { ...metadata, ...change }, 2),
      ).rejects.toThrow("pagination");
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("caps previews at 100 even for a large advertised server limit", async () => {
    respond({
      features: [record(1)],
      exceededTransferLimit: false,
      spatialReference: { latestWkid: 4326 },
    });
    const page = await getPage(dataset, { ...metadata, maxRecordCount: 2000 });
    expect(page.limit).toBe(100);
    expect(
      new URL(vi.mocked(fetch).mock.calls[0][0] as string).searchParams.get(
        "resultRecordCount",
      ),
    ).toBe("100");
  });
  it.each([
    ["full page with no flag", [record(1), record(2)], undefined, true],
    ["short page with no flag", [record(1)], undefined, false],
    ["short page explicitly continued", [record(1)], true, true],
    ["full page explicitly final", [record(1), record(2)], false, false],
  ] as const)(
    "handles %s conservatively",
    async (_label, features, flag, more) => {
      respond({ features, exceededTransferLimit: flag });
      expect(
        (await getPage(dataset, { ...metadata, geometryType: null })).hasMore,
      ).toBe(more);
    },
  );
  it("retains zero, false, null and date-epoch values without coercion", async () => {
    const attributes = {
      OBJECTID: 1,
      COUNT: 0,
      OPEN: false,
      NOTE: null,
      DATE: 1793750400000,
    };
    respond({ features: [{ attributes }] });
    expect(
      (await getPage(dataset, { ...metadata, geometryType: null })).records[0]
        .attributes,
    ).toEqual(attributes);
  });
  it("accepts an empty initial preview without an OID or geometry", async () => {
    respond({ features: [] });
    const page = await getPage(dataset, {
      ...metadata,
      objectIdField: null,
      geometryType: null,
    });
    expect(page).toMatchObject({ records: [], hasMore: false, geojson: null });
    expect(page.warning).toContain("pagination");
  });
  it("keeps table attributes when a feature geometry is invalid", async () => {
    respond({
      features: [{ attributes: { OBJECTID: 1 }, geometry: { x: 900, y: 28 } }],
      spatialReference: { wkid: 4326 },
    });
    const page = await getPage(dataset, metadata);
    expect(page.records[0].attributes.OBJECTID).toBe(1);
    expect(page.geojson).toBeNull();
    expect(page.warning).toContain("invalid WGS84");
  });
});
describe("geographic shape preservation", () => {
  it.each([
    { wkid: 3857 },
    { latestWkid: 3857 },
    { wkid: 102100, latestWkid: 3857 },
    { wkid: "4326" },
    {},
    null,
  ])(
    "rejects a feature-level non-WGS84 or invalid CRS %j",
    (spatialReference) => {
      expect(() =>
        normalizeGeometry(
          [{ attributes: {}, geometry: { x: 10, y: 10, spatialReference } }],
          true,
        ),
      ).toThrow("WGS84");
    },
  );
  it("does not allow a top-level WGS84 CRS to conceal a projected feature CRS", () => {
    expect(() =>
      normalizeGeometry(
        [
          {
            attributes: {},
            geometry: { x: 10, y: 10, spatialReference: { wkid: 3857 } },
          },
        ],
        true,
        { wkid: 4326 },
      ),
    ).toThrow("WGS84");
  });
  it("accepts an explicitly WGS84 feature and retains null geometry", () => {
    const result = normalizeGeometry(
      [
        {
          attributes: {},
          geometry: { x: -82, y: 28, spatialReference: { wkid: 4326 } },
        },
        { attributes: {}, geometry: null },
      ],
      true,
    );
    expect(result?.features[0].geometry).toEqual({
      type: "Point",
      coordinates: [-82, 28],
    });
    expect(result?.features[1].geometry).toBeNull();
  });
  it.each([
    { paths: [[[-82, 28]]] },
    { paths: [] },
    {
      paths: [
        [
          [-82, 28],
          [-81, 29],
        ],
        [[-82, 28]],
      ],
    },
    {
      rings: [
        [
          [-82, 28],
          [-81, 29],
        ],
      ],
    },
    { points: [] },
    { points: [[-82]] },
  ])(
    "rejects invalid coordinate nesting and shape structure %j",
    (geometry) => {
      expect(() =>
        normalizeGeometry([{ attributes: {}, geometry }], true, { wkid: 4326 }),
      ).toThrow();
    },
  );
  it("disables GeoJSON but preserves records when feature CRS validation fails", async () => {
    respond({
      features: [
        {
          attributes: { OBJECTID: 1 },
          geometry: { x: 10, y: 10, spatialReference: { wkid: 3857 } },
        },
      ],
    });
    const page = await getPage(dataset, metadata);
    expect(page.geojson).toBeNull();
    expect(page.warning).toContain("WGS84");
    expect(page.records[0].attributes.OBJECTID).toBe(1);
  });
  it("disables GeoJSON but preserves records when geometry structure is invalid", async () => {
    respond({
      features: [
        { attributes: { OBJECTID: 1 }, geometry: { paths: [[[-82, 28]]] } },
      ],
      spatialReference: { wkid: 4326 },
    });
    const page = await getPage(dataset, metadata);
    expect(page.geojson).toBeNull();
    expect(page.warning).toContain("invalid WGS84 geometry");
    expect(page.records).toHaveLength(1);
  });
  it("preserves polygon holes", () => {
    const fc = normalizeGeometry(
      [
        {
          attributes: {},
          geometry: {
            rings: [
              [
                [-83, 27],
                [-83, 29],
                [-81, 29],
                [-81, 27],
                [-83, 27],
              ],
              [
                [-82.5, 27.5],
                [-81.5, 27.5],
                [-81.5, 28.5],
                [-82.5, 28.5],
                [-82.5, 27.5],
              ],
            ],
          },
        },
      ],
      true,
      { wkid: 4326 },
    );
    const geometry = fc!.features[0].geometry;
    expect(geometry?.type).toBe("Polygon");
    if (geometry?.type !== "Polygon")
      throw new Error("Polygon was not preserved");
    expect(geometry.coordinates).toHaveLength(2);
  });
  it("preserves multiline segments", () => {
    const fc = normalizeGeometry(
      [
        {
          attributes: {},
          geometry: {
            paths: [
              [
                [-83, 27],
                [-82, 28],
              ],
              [
                [-82, 28],
                [-81, 29],
              ],
            ],
          },
        },
      ],
      true,
      { wkid: 4326 },
    );
    expect(fc?.features[0].geometry?.type).toBe("MultiLineString");
  });
  it("returns an informative error for unsupported geometry", () => {
    expect(() =>
      normalizeGeometry([{ attributes: {}, geometry: { unknown: [] } }], true, {
        wkid: 4326,
      }),
    ).toThrow("unsupported geometry");
  });
});
