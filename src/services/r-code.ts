import curated from "../../public/catalog.json";
import portals from "../../config/portals.json";
import type { Dataset } from "../types";
import { endpointAllowed } from "./source-url";

export interface ROptions {
  full?: boolean;
  spatial?: boolean;
}
export type RExample =
  | {
      supported: true;
      code: string;
      spatialAvailable: boolean;
      checked: boolean;
    }
  | { supported: false; reason: string };
const checkedDatasets = new Map(
  curated.datasets.map((dataset) => [dataset.id, dataset]),
);
const prefixes = [
  ...portals.flatMap((portal) => portal.servicePrefixes),
  ...curated.datasets.map((dataset) => dataset.serviceUrl + "/"),
];

// R double-quoted strings do not interpolate values. Encode control characters,
// quotes, backslashes and Unicode explicitly; never interpolate metadata as code.
export function rString(value: string) {
  const encoded = Array.from(value, (char) => {
    const point = char.codePointAt(0)!;
    if (point === 0 || (point >= 0xd800 && point <= 0xdfff))
      throw Error("Invalid character in R string.");
    if (char === "\\") return "\\\\";
    if (char === '"') return '\\"';
    if (point < 32 || point >= 127)
      return point <= 0xffff
        ? "\\u" + point.toString(16).padStart(4, "0")
        : "\\U" + point.toString(16).padStart(8, "0");
    return char;
  }).join("");
  return '"' + encoded + '"';
}

function layerURL(dataset: Dataset) {
  if (
    !dataset.serviceUrl ||
    dataset.serviceUrl.length > 2048 ||
    !Number.isSafeInteger(dataset.layerId) ||
    dataset.layerId! < 0
  )
    return null;
  if (
    Array.from(dataset.serviceUrl).some((char) => {
      const point = char.codePointAt(0)!;
      return (
        char === "\\" ||
        point <= 32 ||
        point === 127 ||
        (point >= 0xd800 && point <= 0xdfff)
      );
    })
  )
    return null;
  const url = `${dataset.serviceUrl}/${dataset.layerId}`;
  if (
    !/\/(FeatureServer|MapServer)\/\d+$/.test(url) ||
    !endpointAllowed(url, prefixes)
  )
    return null;
  return url;
}

function checkedEntry(dataset: Dataset) {
  const entry = checkedDatasets.get(dataset.id);
  return dataset.validationStatus !== "discovered" &&
    entry &&
    entry.packageId === dataset.packageId &&
    entry.serviceUrl === dataset.serviceUrl &&
    entry.layerId === dataset.layerId
    ? entry
    : undefined;
}

export function rExample(dataset: Dataset, options: ROptions = {}): RExample {
  if (dataset.platform && dataset.platform !== "arcgis")
    return {
      supported: false,
      reason:
        "The tampaBayOpenData package retrieves ArcGIS FeatureServer and MapServer layers. This source platform is not supported; use the publisher’s download options.",
    };
  const url = layerURL(dataset);
  if (!url)
    return {
      supported: false,
      reason:
        "A valid registered public HTTPS ArcGIS layer URL is required to generate R code for this dataset.",
    };
  if (dataset.queryable === false)
    return {
      supported: false,
      reason:
        "This ArcGIS layer does not advertise record-query support. Use the publisher’s download options.",
    };
  const entry = checkedEntry(dataset);
  const checked = !!entry;
  const spatialAvailable = dataset.geometryType !== "none";
  const spatial = options.spatial === true && spatialAvailable;
  const target = checked ? entry!.packageId : url;
  return {
    supported: true,
    code: renderRCode(target, checked, spatial, options.full === true),
    spatialAvailable,
    checked,
  };
}

function renderRCode(
  target: string,
  checked: boolean,
  spatial: boolean,
  full: boolean,
) {
  const fn = checked ? "tbod_get_dataset" : "tbod_get_arcgis_layer";
  const lines = [
    "# Install once from CRAN:",
    'if (!requireNamespace("tampaBayOpenData", quietly = TRUE)) {',
    '  install.packages("tampaBayOpenData")',
    "}",
    "library(tampaBayOpenData)",
  ];
  if (spatial)
    lines.push(
      "",
      'if (!requireNamespace("sf", quietly = TRUE)) {',
      '  install.packages("sf")',
      "}",
    );
  lines.push(
    "",
    full
      ? "# Full retrieval: may take a long time and use substantial memory."
      : "# Preview: retrieve up to 100 records, not the complete dataset.",
    `data <- ${fn}(${rString(target)}, limit = ${full ? "Inf" : "100"}${spatial ? ", spatial = TRUE" : ""})`,
    "",
    "head(data)",
    "str(data)",
  );
  if (spatial) lines.push("sf::st_geometry(data)");
  return lines.join("\n") + "\n";
}
