import Fuse from "fuse.js";
import { catalogSchema, type Dataset } from "../types";
export const parseCatalog = (value: unknown) => catalogSchema.parse(value);
export interface Filters {
  query: string;
  publisher: string;
  category: string;
  spatial: string;
}
export function searchCatalog(datasets: Dataset[], filters: Filters) {
  const candidates = datasets.filter(
    (d) =>
      (!filters.publisher || d.publisher === filters.publisher) &&
      (!filters.category || d.category === filters.category) &&
      (!filters.spatial ||
        (filters.spatial === "spatial"
          ? d.geometryType !== "none"
          : d.geometryType === "none")),
  );
  return filters.query.trim()
    ? new Fuse(candidates, {
        keys: [
          { name: "title", weight: 3 },
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
