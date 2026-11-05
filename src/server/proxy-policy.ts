import type { Dataset } from "../types";
import policy from "../../config/proxy.json";
import { endpointAllowed } from "../services/source-url";
import { z } from "zod";

const common = new Set(["dataset", "operation", "f"]);
const queryKeys = new Set([
  "where",
  "outFields",
  "returnGeometry",
  "outSR",
  "resultOffset",
  "resultRecordCount",
  "orderByFields",
  "geometry",
  "geometryType",
  "inSR",
  "spatialRel",
]);
const identifier = "[A-Za-z_][A-Za-z0-9_.]*";
const literal = "(?:[+-]?(?:\\d+\\.?\\d*|\\.\\d+)|'(?:[^']|'')*')";
const wherePattern = new RegExp(
  `^(?:1=1|${identifier} (?:IS NULL|(?:=|<>|>=|<=|>|<|LIKE) ${literal}))$`,
);

export class ProxyError extends Error {
  constructor(
    message: string,
    public status = 400,
    public retryAfter = 0,
  ) {
    super(message);
  }
}

export function validateProxyRequest(request: Request) {
  const values = requestParameters(request);
  const operation = validatedOperation(values);
  const id = values.get("dataset");
  if (
    !id ||
    id.length > 160 ||
    !/^(?:[a-z0-9_-]+\/[a-z0-9_-]+|arcgis:[a-f0-9]{32}:\d+)$/i.test(id)
  )
    throw new ProxyError("Dataset is not registered.", 404);
  if (operation === "query")
    addQuery(new URL("https://validation.invalid/"), values);
  return { id, operation };
}

export function proxyTarget(request: Request, datasets: readonly Dataset[]) {
  const values = requestParameters(request);
  const dataset = registeredDataset(values.get("dataset"), datasets);
  const endpoint = `${dataset.serviceUrl}/${dataset.layerId}`;
  const operation = validatedOperation(values);
  const target = new URL(endpoint + (operation === "query" ? "/query" : ""));
  target.searchParams.set("f", "json");
  if (operation === "query") addQuery(target, values);
  return { target, datasetId: dataset.id, operation };
}

function requestParameters(request: Request) {
  if (request.method !== "GET")
    throw new ProxyError("Only GET is supported.", 405);
  const incoming = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== incoming.origin)
    throw new ProxyError("Cross-origin proxy requests are not allowed.", 403);
  const values = incoming.searchParams;
  for (const key of values.keys())
    if (values.getAll(key).length !== 1)
      throw new ProxyError("Duplicate query parameters are not allowed.");
  return values;
}

function registeredDataset(id: string | null, datasets: readonly Dataset[]) {
  const dataset = datasets.find((dataset) => dataset.id === id);
  if (!dataset) throw new ProxyError("Dataset is not registered.", 404);
  const endpoint = `${dataset.serviceUrl}/${dataset.layerId}`;
  if (!endpointAllowed(endpoint, policy.servicePrefixes))
    throw new ProxyError(
      "This source is not eligible for the CORS proxy.",
      403,
    );
  if (!/\/(FeatureServer|MapServer)\/\d+$/.test(new URL(endpoint).pathname))
    throw new ProxyError("Only registered ArcGIS layers are supported.", 403);
  return dataset;
}

function validatedOperation(values: URLSearchParams) {
  const operation = values.get("operation");
  if (operation !== "metadata" && operation !== "query")
    throw new ProxyError("Unsupported operation.");
  for (const [key, value] of values) {
    if (!common.has(key) && !(operation === "query" && queryKeys.has(key)))
      throw new ProxyError(`Unsupported parameter: ${key}`);
    if (value.length > 2048)
      throw new ProxyError("Query parameter is too long.");
  }
  if (values.has("f") && values.get("f") !== "json")
    throw new ProxyError("Only JSON is supported.");
  return operation;
}

function integer(value: string | null, fallback: number, max: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || Number(value) > max)
    throw new ProxyError("Query limit or offset is out of range.");
  return Number(value);
}

function addQuery(target: URL, values: URLSearchParams) {
  const count = integer(
    values.get("resultRecordCount"),
    100,
    policy.maxRecords,
  );
  const offset = integer(values.get("resultOffset"), 0, policy.maxOffset);
  if (count < 1 || count + offset > 10000)
    throw new ProxyError("Preview limits exceeded.");
  const where = values.get("where") ?? "1=1";
  if (where.length > 1024 || !wherePattern.test(where))
    throw new ProxyError("Only a single supported field filter is allowed.");
  if (values.has("geometry")) validateBounds(values.get("geometry")!);
  for (const [key, value] of values) {
    if (queryKeys.has(key)) target.searchParams.set(key, value);
  }
  validateFixedParameters(target);
  target.searchParams.set("where", where);
  target.searchParams.set("resultRecordCount", String(count));
}

function validateFixedParameters(target: URL) {
  const p = target.searchParams;
  const fixed: Record<string, string> = {
    outFields: "*",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
  };
  for (const [key, value] of Object.entries(fixed))
    if (p.has(key) && p.get(key) !== value)
      throw new ProxyError(`Unsupported ${key}.`);
  if (
    p.has("returnGeometry") &&
    !["true", "false"].includes(p.get("returnGeometry")!)
  )
    throw new ProxyError("Invalid geometry flag.");
  const order = p.get("orderByFields");
  if (order && !new RegExp(`^${identifier} ASC$`).test(order))
    throw new ProxyError("Only ascending object-ID ordering is allowed.");
}

const boundsSchema = z
  .object({
    xmin: z.number().min(-180).max(180),
    xmax: z.number().min(-180).max(180),
    ymin: z.number().min(-90).max(90),
    ymax: z.number().min(-90).max(90),
    spatialReference: z.object({ wkid: z.literal(4326) }).strict(),
  })
  .strict()
  .refine((box) => box.xmin <= box.xmax && box.ymin <= box.ymax);
function validateBounds(value: string) {
  let box: unknown;
  try {
    box = JSON.parse(value);
  } catch {
    throw new ProxyError("Invalid map bounds.");
  }
  if (!boundsSchema.safeParse(box).success)
    throw new ProxyError(
      "Only finite, non-wrapping WGS84 map bounds are supported.",
    );
}
