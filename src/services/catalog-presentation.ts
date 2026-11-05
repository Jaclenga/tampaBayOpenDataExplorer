import type { Dataset } from "../types";
import { accessExplanation } from "./access-check";
export function geometryLabel(geometry: string | null | undefined) {
  switch (geometry) {
    case "esriGeometryPoint":
      return "Point layer";
    case "esriGeometryMultipoint":
      return "Multipoint layer";
    case "esriGeometryPolyline":
      return "Line layer";
    case "esriGeometryPolygon":
      return "Polygon layer";
    case "none":
      return "Table";
    default:
      return "Dataset";
  }
}
export function datasetMetadata(
  dataset: Pick<Dataset, "publisher" | "category" | "geometryType">,
) {
  return [
    dataset.publisher,
    dataset.category,
    geometryLabel(dataset.geometryType),
  ]
    .filter((value): value is string => !!value?.trim())
    .map((value) => value.trim())
    .join(" \u00b7 ");
}
export function catalogAccessStatus(reason: string | null | undefined) {
  if (!reason) return null;
  const explanation = accessExplanation(reason);
  const missing = /\b(?:HTTP\s*(?:404|410)|not found)\b/i.test(reason);
  const failed = missing || ["offline", "timeout"].includes(explanation.kind);
  return {
    failed,
    label: missing
      ? "Source unavailable at last check"
      : explanation.kind === "timeout"
        ? "Last source check timed out"
        : "Last source check failed",
    explanation,
    reason,
  };
}
