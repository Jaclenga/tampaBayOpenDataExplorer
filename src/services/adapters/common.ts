import type {
  Attributes,
  Dataset,
  Field,
  LayerMetadata,
  Page,
} from "../../types";
import type { PageRequest } from "./types";
export function resource(dataset: Dataset) {
  if (!dataset.resource) throw Error("Source resource metadata is missing.");
  return dataset.resource;
}
export function plainMetadata(
  fields: Field[],
  options: Partial<LayerMetadata> = {},
): LayerMetadata {
  return {
    fields,
    objectIdField: null,
    geometryType: null,
    maxRecordCount: 100,
    pagination: true,
    orderBy: false,
    geojson: false,
    query: true,
    inspectedAt: new Date().toISOString(),
    ...options,
  };
}
export function pageLimits(request: PageRequest) {
  const offset = request.offset ?? 0;
  const limit = Math.min(request.limit ?? 100, 100, 10000 - offset);
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset >= 10000 ||
    !Number.isInteger(limit) ||
    limit < 1
  )
    throw Error("Preview limits exceeded.");
  if (request.bounds)
    throw Error("This source does not support map-area filters.");
  return { offset, limit };
}
export function attributes(row: Record<string, unknown>): Attributes {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value !== null && typeof value === "object"
        ? JSON.stringify(value)
        : (value as Attributes[string]),
    ]),
  );
}
export function plainPage(
  rows: Record<string, unknown>[],
  offset: number,
  limit: number,
  hasMore: boolean,
  warning: string | null = null,
  identity?: { field: string; previousIds?: Set<string> },
): Page {
  if (!rows.length && hasMore)
    throw Error(
      "Publisher reports more results but returned an empty page. Pagination stopped.",
    );
  if (identity) validatePageIds(rows, identity.field, identity.previousIds);
  return {
    records: rows.map((row) => ({ attributes: attributes(row) })),
    geojson: null,
    offset,
    limit,
    hasMore,
    warning,
    retrievedAt: new Date().toISOString(),
  };
}

function validatePageIds(
  rows: Record<string, unknown>[],
  field: string,
  previousIds?: Set<string>,
) {
  const seen = new Set<string>();
  for (const row of rows) {
    const id = row[field];
    if (
      id === null ||
      id === undefined ||
      seen.has(String(id)) ||
      previousIds?.has(String(id))
    )
      throw Error(
        "Publisher returned missing or repeated record IDs. Pagination stopped.",
      );
    seen.add(String(id));
  }
}
