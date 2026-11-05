import type {
  Catalog,
  Dataset,
  LayerMetadata,
  RecordFeature,
} from "../src/types";
import type { AccessReport } from "../src/services/access";

export const dataset: Dataset = {
  id: "test/parks",
  packageId: "parks",
  title: "Neighborhood parks",
  description: "Public gardens and recreation grounds.",
  publisher: "Test City",
  jurisdiction: "test",
  coverage: null,
  category: "Recreation",
  serviceUrl:
    "https://data.example.test/arcgis/rest/services/Parks/FeatureServer",
  layerId: 0,
  geometryType: "esriGeometryPoint",
  fields: null,
  verified: "2026-11-04",
  sourceUrl: "https://data.example.test/parks",
  terms: null,
  termsUrl: null,
  scopeNote: null,
  tags: ["greenspace"],
};
export const fields = [
  { name: "OBJECTID", type: "esriFieldTypeOID", alias: "Record ID" },
  { name: "NAME", type: "esriFieldTypeString", alias: "Name" },
  { name: "VALUE", type: "esriFieldTypeDouble", alias: "Value" },
];
export const metadata: LayerMetadata = {
  fields,
  objectIdField: "OBJECTID",
  geometryType: "esriGeometryPoint",
  maxRecordCount: 2,
  pagination: true,
  orderBy: true,
  geojson: true,
  query: true,
};
export const layerResponse = {
  fields,
  objectIdField: "OBJECTID",
  geometryType: "esriGeometryPoint",
  maxRecordCount: 2,
  capabilities: "Query",
  supportedQueryFormats: "JSON, geoJSON",
  advancedQueryCapabilities: {
    supportsPagination: true,
    supportsOrderBy: true,
  },
};
export const record = (
  id: number,
  name = `Park ${id}`,
  value = id,
): RecordFeature => ({
  attributes: { OBJECTID: id, NAME: name, VALUE: value },
  geometry: { x: -82.45 + id / 10000, y: 27.95 },
});
export const catalog: Catalog = {
  schemaVersion: 1,
  upstreamCommit: "a".repeat(40),
  generatedAt: "2026-11-04T12:00:00.000Z",
  datasets: [
    dataset,
    {
      ...dataset,
      id: "county/budget",
      packageId: "budget",
      title: "Budget allocations",
      description: null,
      publisher: "Test County",
      jurisdiction: "county",
      category: "Finance",
      geometryType: "none",
      layerId: 1,
      tags: [],
    },
    {
      ...dataset,
      id: "test/roads",
      packageId: "roads",
      title: "Street centerlines",
      description: "Transportation network.",
      category: "Transportation",
      geometryType: "esriGeometryPolyline",
      layerId: 2,
      tags: ["roadway"],
    },
  ],
};

export const accessReport: AccessReport = {
  schemaVersion: 1,
  checkedAt: "2026-11-04T12:00:00.000Z",
  catalogCommit: catalog.upstreamCommit,
  origin: "https://explorer.example.test",
  datasets: catalog.datasets.map((d) => ({
    id: d.id,
    endpoint: `${d.serviceUrl}/${d.layerId}`,
    status: "available",
    stage: "complete",
    reason: null,
    recordCount: 1,
  })),
};
