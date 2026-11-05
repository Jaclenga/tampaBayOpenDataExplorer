import { describe, it, expect, vi } from "vitest";
import { dataset, metadata, record } from "../fixtures";
import type { Dataset } from "../../src/types";
import { getAdapter } from "../../src/services/adapters";
import { parseCsv } from "../../src/services/adapters/files";
import {
  plainMetadata,
  pageLimits,
  attributes,
} from "../../src/services/adapters/common";
import { boundedText } from "../../src/services/bounded-response";
import { csv, geojson } from "../../src/services/export";
const external = (platform: Dataset["platform"]): Dataset => ({
  ...dataset,
  platform,
  serviceUrl: null,
  layerId: null,
  resource: {
    url: "https://data.example.test/resource/abcd-1234.json",
    apiRoot: "https://data.example.test",
    id: "abcd-1234",
  },
});
const ckan = (
  records: Record<string, unknown>[] = [],
  total = records.length,
) => ({
  success: true,
  result: {
    fields: [
      { id: "_id", type: "int4" },
      { id: "Name", type: "text" },
    ],
    records,
    total,
  },
});
describe("live CKAN adapter", () => {
  it("reads fields and requests stable bounded pages with typed equality filters", async () => {
    const d = external("ckan");
    const adapter = getAdapter(d);
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json(ckan()))
      .mockResolvedValueOnce(
        Response.json(ckan([{ _id: 101, Name: "Park" }], 1000)),
      );
    const m = await adapter.inspect(d);
    expect(m).toMatchObject({
      objectIdField: "_id",
      orderBy: true,
      filterOperators: ["eq"],
    });
    const page = await adapter.page(d, m, {
      offset: 100,
      filter: { field: "_id", operator: "eq", value: "101" },
    });
    const url = new URL(String(vi.mocked(fetch).mock.calls[1][0]));
    expect(url.searchParams.get("offset")).toBe("100");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.get("filters")).toBe('{"_id":101}');
    expect(page.records[0].attributes.Name).toBe("Park");
    expect(page.hasMore).toBe(true);
    expect(csv(page.records, m.fields)).toContain("Park");
  });
  it("sends text filters as JSON literals", async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json(ckan([{ _id: 1, Name: "O'Brien" }])),
    );
    const d = external("ckan");
    const a = getAdapter(d);
    const m = await a.inspect(d);
    await a.page(d, m, {
      filter: { field: "Name", operator: "eq", value: "O'Brien" },
    });
    expect(
      new URL(String(vi.mocked(fetch).mock.lastCall![0])).searchParams.get(
        "filters",
      ),
    ).toBe('{"Name":"O\'Brien"}');
  });
  it("fails clearly for unavailable DataStore, missing configuration, unsupported filters, or ignored limits", async () => {
    const d = external("ckan");
    const a = getAdapter(d);
    await expect(
      a.inspect({ ...d, resource: { url: d.resource!.url } }),
    ).rejects.toThrow("configuration");
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ success: false, error: { message: "not active" } }),
    );
    await expect(a.inspect(d)).rejects.toThrow();
    await expect(
      a.page(d, metadata, {
        filter: { field: "NAME", operator: "contains", value: "park" },
      }),
    ).rejects.toThrow("equality");
    vi.mocked(fetch).mockResolvedValue(
      Response.json(ckan([{ _id: 1 }, { _id: 2 }])),
    );
    await expect(a.page(d, metadata, { limit: 1 })).rejects.toThrow("ignored");
  });
  it("handles schemas without object IDs", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        success: true,
        result: {
          fields: [{ id: "Name", type: "text" }],
          records: [],
          total: 0,
        },
      }),
    );
    const d = external("ckan");
    expect((await getAdapter(d).inspect(d)).objectIdField).toBeNull();
  });
});
describe("live Socrata adapter", () => {
  it("parses metadata, distinct source update time and paginated SoQL filters", async () => {
    const d = external("socrata");
    const a = getAdapter(d);
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        Response.json({
          columns: [
            { fieldName: ":id", name: "ID", dataTypeName: "number" },
            { fieldName: "name", name: "Name", dataTypeName: "text" },
          ],
          rowsUpdatedAt: 1700000000,
        }),
      )
      .mockResolvedValueOnce(
        Response.json([{ name: "O'Brien", location: { latitude: 27 } }]),
      );
    const m = await a.inspect(d);
    expect(m.fields).toHaveLength(1);
    expect(m.sourceUpdatedAt).toBe("2023-11-14T22:13:20.000Z");
    const page = await a.page(d, m, {
      offset: 10,
      limit: 1,
      filter: { field: "name", operator: "eq", value: "O'Brien" },
    });
    expect(
      new URL(String(vi.mocked(fetch).mock.lastCall![0])).searchParams.get(
        "$where",
      ),
    ).toBe("name = 'O''Brien'");
    expect(page.records[0].attributes.location).toBe('{"latitude":27}');
    expect(page.hasMore).toBe(true);
    expect(page.geojson).toBeNull();
    expect(() => geojson(page)).toThrow();
  });
  it("handles absent update time and rejects malformed views or excessive records", async () => {
    const d = external("socrata");
    const a = getAdapter(d);
    await expect(
      a.inspect({ ...d, resource: { ...d.resource!, id: "invalid" } }),
    ).rejects.toThrow("Invalid");
    vi.mocked(fetch).mockResolvedValue(Response.json({ columns: [] }));
    expect((await a.inspect(d)).sourceUpdatedAt).toBeNull();
    vi.mocked(fetch).mockResolvedValue(Response.json([{ a: 1 }, { a: 2 }]));
    await expect(a.page(d, metadata, { limit: 1 })).rejects.toThrow("ignored");
  });
});
describe("bounded live file previews", () => {
  it("parses BOM, multiline values, commas, escaped quotes, CRLF, final cells and blanks", () => {
    expect(
      parseCsv('\uFEFFName,Note\r\n"Bay, Park","a\n""quote"""\r\n\r\nOak,x'),
    ).toEqual([
      { Name: "Bay, Park", Note: 'a\n"quote"' },
      { Name: "Oak", Note: "x" },
    ]);
    expect(parseCsv("A,B\n1,")).toEqual([{ A: "1", B: "" }]);
    expect(parseCsv("A\r1\r")).toEqual([{ A: "1" }]);
  });
  it.each(["A,A\n1,2", ",B\n1,2", "A,B\n1", 'A\n"unterminated', ""])(
    "rejects malformed CSV %j",
    (text) => expect(() => parseCsv(text)).toThrow(),
  );
  it("retrieves CSV metadata and each page live, with publisher modification time", async () => {
    const d = external("csv");
    const a = getAdapter(d);
    vi.mocked(fetch).mockImplementation(
      async () =>
        new Response("Name,Value\nPark,1\nBay,2", {
          headers: { "Last-Modified": "Tue, 14 Nov 2023 22:13:20 GMT" },
        }),
    );
    const m = await a.inspect(d);
    expect(m.fields).toEqual([
      { name: "Name", type: "string" },
      { name: "Value", type: "string" },
    ]);
    expect(m.filterOperators).toEqual([]);
    expect(m.sourceUpdatedAt).toBe("2023-11-14T22:13:20.000Z");
    const page = await a.page(d, m, { offset: 1, limit: 1 });
    expect(page.records[0].attributes.Name).toBe("Bay");
    expect(page.hasMore).toBe(false);
    expect(csv(page.records, m.fields)).toContain("Bay");
    expect(fetch).toHaveBeenCalledTimes(2);
    await expect(
      a.page(d, m, { filter: { field: "Name", operator: "eq", value: "Bay" } }),
    ).rejects.toThrow("do not support");
  });
  it("caps JSON preview at 1,000 rows and clearly marks partial results", async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json(
        Array.from({ length: 1001 }, (_, i) => ({ id: i, nested: { a: 1 } })),
      ),
    );
    const d = external("json");
    const a = getAdapter(d);
    const m = await a.inspect(d);
    expect(m.sourceUpdatedAt).toBeNull();
    const page = await a.page(d, m, { offset: 900 });
    expect(page.records).toHaveLength(100);
    expect(page.hasMore).toBe(false);
    expect(page.warning).toContain("partial");
    expect(page.records[0].attributes.nested).toBe('{"a":1}');
  });
  it("handles empty files, failed requests, bad dates, and malformed JSON", async () => {
    const d = external("json");
    const a = getAdapter(d);
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json([], { headers: { "Last-Modified": "invalid" } }),
    );
    expect((await a.inspect(d)).fields).toEqual([]);
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 429 }));
    await expect(a.inspect(d)).rejects.toThrow("429");
    vi.mocked(fetch).mockResolvedValue(Response.json({ changed: "schema" }));
    await expect(a.inspect(d)).rejects.toThrow();
  });
  it("cancels oversized streams and handles absent bodies", async () => {
    await expect(
      boundedText(new Response("x".repeat(1048577)), 1048576),
    ).rejects.toThrow("safe preview");
    expect(await boundedText(new Response(null), 100)).toBe("");
    expect(await boundedText(new Response("small"), 100)).toBe("small");
  });
});
describe("adapter guards", () => {
  it("requires configured adapters and resource descriptors", async () => {
    expect(() =>
      getAdapter({
        ...dataset,
        platform: "unsupported" as Dataset["platform"],
      }),
    ).toThrow("not supported");
    await expect(
      getAdapter(external("json")).inspect({
        ...external("json"),
        resource: undefined,
      }),
    ).rejects.toThrow("missing");
  });
  it.each([-1, 10000, 1.5])("rejects invalid page offset %s", (offset) =>
    expect(() => pageLimits({ offset })).toThrow("limits"),
  );
  it("enforces map capabilities and bounded final page sizes", () => {
    expect(() => pageLimits({ bounds: [-83, 27, -82, 28] })).toThrow(
      "map-area",
    );
    expect(pageLimits({ offset: 9999, limit: 1000 })).toEqual({
      offset: 9999,
      limit: 1,
    });
    expect(() => pageLimits({ limit: 0 })).toThrow("limits");
    expect(plainMetadata([]).query).toBe(true);
    expect(attributes({ a: null, b: true, c: { nested: 1 } })).toEqual({
      a: null,
      b: true,
      c: '{"nested":1}',
    });
    expect(record(1)).toBeTruthy();
  });
});
