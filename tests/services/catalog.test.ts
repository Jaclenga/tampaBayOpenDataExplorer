import { describe, expect, it } from "vitest";
import {
  parseCatalog,
  searchCatalog,
  sortCatalog,
  type Filters,
} from "../../src/services/catalog";
import { catalog, dataset } from "../fixtures";

const filters: Filters = {
  query: "",
  publisher: "",
  category: "",
  spatial: "",
};
describe("catalog schema contracts", () => {
  it("preserves explicit missing values instead of inventing metadata", () => {
    const parsed = parseCatalog(catalog);
    expect(parsed.datasets[0]).toMatchObject({
      coverage: null,
      fields: null,
      terms: null,
    });
  });
  it.each([
    ["version", { ...catalog, schemaVersion: 2 }],
    ["commit", { ...catalog, upstreamCommit: "main" }],
    ["timestamp", { ...catalog, generatedAt: "yesterday" }],
    ["empty", { ...catalog, datasets: [] }],
    [
      "duplicate endpoint",
      { ...catalog, datasets: [dataset, { ...dataset, id: "test/other" }] },
    ],
    ["invalid layer", { ...catalog, datasets: [{ ...dataset, layerId: -1 }] }],
    [
      "invalid geometry",
      { ...catalog, datasets: [{ ...dataset, geometryType: "Point" }] },
    ],
    [
      "invalid verification",
      { ...catalog, datasets: [{ ...dataset, verified: "2026-02-30" }] },
    ],
    [
      "service query injection",
      {
        ...catalog,
        datasets: [
          { ...dataset, serviceUrl: dataset.serviceUrl + "?token=bad" },
        ],
      },
    ],
  ])("rejects %s", (_name, value) =>
    expect(() => parseCatalog(value)).toThrow(),
  );
});
describe("local dataset search", () => {
  it.each([
    ["gardens", "test/parks"],
    ["greenspace", "test/parks"],
    ["roadway", "test/roads"],
    ["BUDGET", "county/budget"],
    ["  parks  ", "test/parks"],
  ])("matches metadata query %s", (query, id) => {
    expect(
      searchCatalog(catalog.datasets, { ...filters, query }).map((d) => d.id),
    ).toContain(id);
  });
  it("intersects filters and keeps nonspatial data separate", () => {
    expect(
      searchCatalog(catalog.datasets, {
        ...filters,
        spatial: "nonspatial",
      }).map((d) => d.id),
    ).toEqual(["county/budget"]);
    expect(
      searchCatalog(catalog.datasets, {
        ...filters,
        publisher: "Test City",
        category: "Finance",
      }),
    ).toEqual([]);
  });
  it("does not mutate the collection or fetch records", () => {
    const original = structuredClone(catalog.datasets);
    searchCatalog(catalog.datasets, { ...filters, query: "parks" });
    expect(catalog.datasets).toEqual(original);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("catalog browsing order", () => {
  it("searches identifiers and package identifiers case-insensitively", () => {
    const d = {
      ...dataset,
      id: "city/unique-lookup",
      packageId: "only-package-key",
    };
    for (const query of ["CITY/UNIQUE", "only-package"])
      expect(searchCatalog([d], { ...filters, query })).toEqual([d]);
  });
  it("sorts names, publishers and categories without mutating inputs", () => {
    const source = structuredClone(catalog.datasets);
    expect(sortCatalog(source, "name-asc").map((d) => d.title)).toEqual([
      "Budget allocations",
      "Neighborhood parks",
      "Street centerlines",
    ]);
    expect(sortCatalog(source, "name-desc").map((d) => d.title)).toEqual([
      "Street centerlines",
      "Neighborhood parks",
      "Budget allocations",
    ]);
    expect(sortCatalog(source, "publisher")[0].publisher).toBe("Test City");
    expect(sortCatalog(source, "category")[0].category).toBe("Finance");
    expect(source).toEqual(catalog.datasets);
  });
  it("places valid newest verification dates first, missing or invalid dates last, and breaks ties by name", () => {
    const rows = [
      { ...dataset, id: "unknown", title: "Z unknown", verified: null },
      {
        ...dataset,
        id: "bad",
        title: "A invalid",
        verified: null,
        lastVerifiedAt: "invalid",
      },
      { ...dataset, id: "old", verified: "2020-01-01" },
      { ...dataset, id: "new", lastVerifiedAt: "2026-11-04T12:00:00Z" },
    ];
    expect(sortCatalog(rows, "verified").map((d) => d.id)).toEqual([
      "new",
      "old",
      "bad",
      "unknown",
    ]);
  });
});
