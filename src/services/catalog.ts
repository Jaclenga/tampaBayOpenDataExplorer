import Fuse from "fuse.js";
import { catalogSchema, type Dataset } from "../types";
export const parseCatalog = (value: unknown) => catalogSchema.parse(value);
export interface Filters {
  query: string;
  publisher: string;
  category: string;
  spatial: string;
  verification?: string;
  platform?: string;
}
export function searchCatalog(datasets: Dataset[], filters: Filters) {
  const candidates = datasets.filter(
    (d) =>
      (!filters.publisher || d.publisher === filters.publisher) &&
      (!filters.category || d.category === filters.category) &&
      (!filters.verification ||
        (d.validationStatus ?? "curated") === filters.verification) &&
      (!filters.platform || (d.platform ?? "arcgis") === filters.platform) &&
      (!filters.spatial ||
        (filters.spatial === "spatial"
          ? d.geometryType !== "none"
          : d.geometryType === "none")),
  );
  return filters.query.trim()
    ? new Fuse(candidates, {
        keys: [
          { name: "title", weight: 3 },
          "id",
          "packageId",
          "description",
          "tags",
          "publisher",
          "category",
        ],
        threshold: 0.35,
        ignoreLocation: true,
      })
        .search(filters.query.trim())
        .map((r) => r.item)
    : candidates;
}

export const catalogSorts = {
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
  publisher: "Publisher",
  category: "Category",
  verified: "Most recently verified",
};
export type CatalogSort = keyof typeof catalogSorts;
function verificationTime(dataset: Dataset) {
  const value = Date.parse(dataset.lastVerifiedAt ?? dataset.verified ?? "");
  return Number.isFinite(value) ? value : -Infinity;
}
export function sortCatalog(datasets: Dataset[], sort: CatalogSort) {
  const compare = (a: string, b: string) =>
    a.localeCompare(b, "en", { sensitivity: "base", numeric: true });
  return [...datasets].sort((a, b) => {
    const byName =
      compare(a.title, b.title) ||
      compare(a.id, b.id) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (sort === "name-desc") return -byName;
    if (sort === "publisher")
      return compare(a.publisher, b.publisher) || byName;
    if (sort === "category")
      return compare(a.category ?? "\uffff", b.category ?? "\uffff") || byName;
    if (sort === "verified") {
      const difference = verificationTime(b) - verificationTime(a);
      if (difference && !Number.isNaN(difference)) return difference;
    }
    return byName;
  });
}
