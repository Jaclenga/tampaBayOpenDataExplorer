import { describe, it, expect } from "vitest";
import {
  readPagination,
  paginateCatalog,
} from "../../src/services/catalog-pagination";
import { sortCatalog } from "../../src/services/catalog";
import { dataset } from "../fixtures";
describe("catalog pagination", () => {
  it.each([
    "",
    "page=-1&pageSize=0",
    "page=1.5&pageSize=30",
    "page=Infinity&pageSize=no",
    "page=9007199254740993&pageSize=200",
  ])("defaults safely for %s", (query) => {
    expect(readPagination(new URLSearchParams(query))).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
  it.each([10, 20, 50, 100])("supports page size %s", (size) => {
    expect(
      readPagination(new URLSearchParams(`page=2&pageSize=${size}`)),
    ).toEqual({ page: 2, pageSize: size });
  });
  it("slices only the current page and clamps the final partial page", () => {
    const rows = Array.from({ length: 63 }, (_, i) => i);
    expect(paginateCatalog(rows, 2, 20)).toMatchObject({
      page: 2,
      pages: 4,
      start: 21,
      end: 40,
      rows: rows.slice(20, 40),
    });
    expect(paginateCatalog(rows, 999, 20)).toEqual({
      page: 4,
      pages: 4,
      start: 61,
      end: 63,
      rows: [60, 61, 62],
    });
    expect(paginateCatalog([], 3, 20)).toEqual({
      page: 1,
      pages: 1,
      start: 0,
      end: 0,
      rows: [],
    });
    expect(paginateCatalog([1, 2], 1, 20).pages).toBe(1);
  });
  it("breaks equal sort values deterministically even for case-only IDs", () => {
    const rows = [
      { ...dataset, id: "a" },
      { ...dataset, id: "A" },
    ];
    expect(sortCatalog(rows, "publisher").map((d) => d.id)).toEqual(["A", "a"]);
    expect(sortCatalog([...rows].reverse(), "publisher")).toEqual(
      sortCatalog(rows, "publisher"),
    );
  });
});
