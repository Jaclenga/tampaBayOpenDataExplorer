import curated from "../../public/catalog.json";
import discovered from "../../public/discovery.json";
import { parseCatalog } from "../../src/services/catalog";
import { discoverySchema } from "../../src/services/discovery/types";
import { handleArcGISProxy } from "../../src/server/arcgis-proxy";
import { latestIndex } from "../../src/server/discovery-index";

const datasets = [
  ...parseCatalog(curated).datasets,
  ...discoverySchema.parse(discovered).datasets,
];
export async function onRequest(context: { request: Request }) {
  const id = new URL(context.request.url).searchParams.get("dataset");
  if (
    !datasets.some((dataset) => dataset.id === id) &&
    /^arcgis:[a-f0-9]{32}:\d+$/i.test(id ?? "") &&
    context.request.method === "GET"
  ) {
    const latest = await latestIndex(context.request.signal);
    return handleArcGISProxy(context.request, [
      ...datasets,
      ...latest.report.datasets,
    ]);
  }
  return handleArcGISProxy(context.request, datasets);
}
