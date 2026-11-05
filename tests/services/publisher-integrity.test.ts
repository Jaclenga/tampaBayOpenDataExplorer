import { describe, expect, it, vi } from "vitest";
import { dataset, metadata } from "../fixtures";
import { compileFilter } from "../../src/services/record-filter";
import { getAdapter } from "../../src/services/adapters";
import { parseCsv } from "../../src/services/adapters/files";
import { releaseProxyLease } from "../../src/server/proxy-admission";
import { csv } from "../../src/services/export";
import type { Dataset } from "../../src/types";

function external(platform: Dataset["platform"]): Dataset {
  return {
    ...dataset,
    platform,
    serviceUrl: null,
    layerId: null,
    resource: {
      url: "https://data.example.test/resource/abcd-1234.json",
      apiRoot: "https://data.example.test///",
      id: "abcd-1234",
    },
  };
}

describe("publisher integrity regressions", () => {
  it.each([
    "9007199254740993",
    "-9007199254740993",
    "0.123456789012345678901",
    "+001.50",
    ".5",
  ])("preserves numeric filter %s exactly", (value) => {
    expect(
      compileFilter({ field: "id", operator: "eq", value }, [
        { name: "id", type: "numeric" },
      ]),
    ).toBe(`id = ${value}`);
  });
  it("normalizes CKAN roots consistently and preserves large numeric filters", async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({
        success: true,
        result: {
          fields: [{ id: "_id", type: "int8" }],
          records: [],
          total: 0,
        },
      }),
    );
    const d = external("ckan");
    const a = getAdapter(d);
    const m = await a.inspect(d);
    await a.page(d, m, {
      filter: { field: "_id", operator: "eq", value: "9007199254740993" },
    });
    for (const [input] of vi.mocked(fetch).mock.calls)
      expect(new URL(String(input)).pathname).toBe(
        "/api/3/action/datastore_search",
      );
    expect(
      new URL(String(vi.mocked(fetch).mock.lastCall![0])).searchParams.get(
        "filters",
      ),
    ).toBe('{"_id":"9007199254740993"}');
  });
  it("requests Socrata system IDs and rejects an ignored offset", async () => {
    const d = external("socrata");
    const a = getAdapter(d);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ columns: [] }));
    const m = await a.inspect(d);
    expect(m.objectIdField).toBe(":id");
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json([{ ":id": "row-one", name: "Park" }]),
    );
    const first = await a.page(d, m, { limit: 1 });
    expect(first.hasMore).toBe(true);
    expect(
      new URL(String(vi.mocked(fetch).mock.lastCall![0])).searchParams.get(
        "$select",
      ),
    ).toBe(":id,*");
    await expect(
      a.page(d, m, { offset: 1, limit: 1, previousIds: new Set(["row-one"]) }),
    ).rejects.toThrow("repeated record IDs");
  });
  it.each([[{ name: "missing" }], [{ ":id": "same" }, { ":id": "same" }]])(
    "rejects untrackable Socrata pages %j",
    async (...rows) => {
      vi.mocked(fetch).mockResolvedValue(Response.json(rows));
      await expect(
        getAdapter(external("socrata")).page(external("socrata"), metadata, {}),
      ).rejects.toThrow("record IDs");
    },
  );
  it("includes JSON fields first appearing after the first page in metadata and exports", async () => {
    const rows = [
      { first: 1 },
      ...Array.from({ length: 100 }, () => ({})),
      { later: 2 },
    ];
    vi.mocked(fetch).mockImplementation(async () => Response.json(rows));
    const d = external("json");
    const a = getAdapter(d);
    const m = await a.inspect(d);
    expect(m.fields.map((f) => f.name)).toEqual(["first", "later"]);
    const page = await a.page(d, m, { offset: 101 });
    expect(csv(page.records, m.fields)).toContain("later");
    expect(page.records[0].attributes.later).toBe(2);
  });
  it.each(['A\n"Oak"x', 'A\nO"ak', 'A\n"Oak" ', 'A\n"Oak""'])(
    "rejects malformed quoted CSV %j",
    (text) => expect(() => parseCsv(text)).toThrow(),
  );
  it("preserves empty quoted fields and escaped quotes", () => {
    expect(parseCsv('\uFEFF"A",B\r\n"","a""b"\r\n')).toEqual([
      { A: "", B: 'a"b' },
    ]);
  });
});

describe("guard release cleanup", () => {
  it("warns and retries HTTP 503, then releases successfully", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const send = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await releaseProxyLease(send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warning.mock.calls[0][0])).toMatchObject({
      event: "proxy_lease_release_failed",
      status: 503,
      attempt: 1,
    });
  });
  it("bounds HTTP and network failure retries without masking the publisher response", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const send = vi.fn().mockRejectedValue(Error("unavailable"));
    await expect(releaseProxyLease(send)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledTimes(2);
  });
  it("does not retry permanent HTTP failures", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 400 }));
    await releaseProxyLease(send);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
