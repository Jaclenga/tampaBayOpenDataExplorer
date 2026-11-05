import type { Dataset } from "../../types";
import type { SourceAdapter } from "./types";
import { arcgisAdapter } from "./arcgis";
import { ckanAdapter } from "./ckan";
import { socrataAdapter } from "./socrata";
import { fileAdapter } from "./files";

const adapters: Record<string, SourceAdapter> = {
  arcgis: arcgisAdapter,
  ckan: ckanAdapter,
  socrata: socrataAdapter,
  csv: fileAdapter,
  json: fileAdapter,
};
export function getAdapter(dataset: Dataset): SourceAdapter {
  const adapter = adapters[dataset.platform ?? "arcgis"];
  if (!adapter)
    throw Error(`The ${dataset.platform} source adapter is not supported.`);
  return adapter;
}
