import { z } from "zod";
export const fieldSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  alias: z.string().optional(),
});
export const datasetSchema = z
  .object({
    id: z.string().min(1),
    packageId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable(),
    publisher: z.string().min(1),
    jurisdiction: z.string(),
    coverage: z.string().nullable(),
    category: z.string().nullable(),
    serviceUrl: z
      .url()
      .regex(/^https:\/\/[^?#]+\/(FeatureServer|MapServer)$/)
      .nullable(),
    layerId: z.number().int().nonnegative().nullable(),
    resource: z
      .object({
        url: z.url().startsWith("https://"),
        apiRoot: z.url().startsWith("https://").optional(),
        id: z.string().optional(),
      })
      .optional(),
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
    platform: z.enum(["arcgis", "ckan", "socrata", "csv", "json"]).optional(),
    validationStatus: z.enum(["curated", "discovered"]).optional(),
    portalId: z.string().optional(),
    itemId: z.string().optional(),
    lastVerifiedAt: z.iso.datetime().nullable().optional(),
    lastAttemptedAt: z.iso.datetime().nullable().optional(),
    sourceUpdatedAt: z.iso.datetime().nullable().optional(),
    sourceUpdatedKind: z
      .enum(["records", "portal-item", "resource"])
      .nullable()
      .optional(),
    verificationError: z.string().nullable().optional(),
    queryable: z.boolean().optional(),
  })
  .superRefine((dataset, context) => {
    if (
      (!dataset.platform || dataset.platform === "arcgis") &&
      (dataset.serviceUrl === null || dataset.layerId === null)
    )
      context.addIssue({
        code: "custom",
        message: "ArcGIS datasets require a service and layer ID.",
      });
    if (dataset.platform && dataset.platform !== "arcgis" && !dataset.resource)
      context.addIssue({
        code: "custom",
        message: "External datasets require a resource descriptor.",
      });
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
      new Set(
        v.datasets.map(
          (d) => d.resource?.url ?? `${d.serviceUrl}/${d.layerId}`,
        ),
      ).size !== v.datasets.length
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
  filterOperators?: string[];
  fields: Field[];
  objectIdField: string | null;
  geometryType: string | null;
  maxRecordCount: number;
  pagination: boolean;
  orderBy: boolean;
  geojson: boolean;
  query: boolean;
  sourceUpdatedAt?: string | null;
  sourceUpdatedKind?: "records" | "portal-item" | "resource" | null;
  inspectedAt?: string;
}
export interface Page {
  records: RecordFeature[];
  geojson: GeoJSON.FeatureCollection<GeoJSON.Geometry | null> | null;
  hasMore: boolean;
  offset: number;
  limit: number;
  warning: string | null;
  retrievedAt?: string;
}
