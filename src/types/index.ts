import { z } from "zod";
export const fieldSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  alias: z.string().optional(),
});
export const datasetSchema = z.object({
  id: z.string().min(1),
  packageId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  publisher: z.string().min(1),
  jurisdiction: z.string(),
  coverage: z.string().nullable(),
  category: z.string().nullable(),
  serviceUrl: z.url().regex(/^https:\/\/[^?#]+\/(FeatureServer|MapServer)$/),
  layerId: z.number().int().nonnegative(),
  geometryType: z.enum([
    "esriGeometryPoint",
    "esriGeometryMultipoint",
    "esriGeometryPolyline",
    "esriGeometryPolygon",
    "none",
  ]),
  fields: z.array(fieldSchema).nullable(),
  verified: z.iso.date().nullable(),
  sourceUrl: z.url(),
  terms: z.string().nullable(),
  termsUrl: z.url().nullable(),
  scopeNote: z.string().nullable(),
  tags: z.array(z.string()),
});
export const catalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    upstreamCommit: z.string().regex(/^[a-f0-9]{40}$/),
    generatedAt: z.iso.datetime(),
    datasets: z.array(datasetSchema).min(1),
  })
  .superRefine((v, c) => {
    if (new Set(v.datasets.map((d) => d.id)).size !== v.datasets.length)
      c.addIssue({ code: "custom", message: "Duplicate dataset identifiers" });
    if (
      new Set(v.datasets.map((d) => `${d.serviceUrl}/${d.layerId}`)).size !==
      v.datasets.length
    )
      c.addIssue({ code: "custom", message: "Duplicate endpoints" });
  });
export type Dataset = z.infer<typeof datasetSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type Attributes = Record<string, string | number | boolean | null>;
export interface RecordFeature {
  attributes: Attributes;
  geometry?: Record<string, unknown> | null;
}
export interface LayerMetadata {
  fields: Field[];
  objectIdField: string | null;
  geometryType: string | null;
  maxRecordCount: number;
  pagination: boolean;
  orderBy: boolean;
  geojson: boolean;
  query: boolean;
}
export interface Page {
  records: RecordFeature[];
  geojson: GeoJSON.FeatureCollection<GeoJSON.Geometry | null> | null;
  hasMore: boolean;
  offset: number;
  limit: number;
  warning: string | null;
}
