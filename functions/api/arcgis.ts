import curated from "../../public/catalog.json";
import discovered from "../../public/discovery.json";
import { parseCatalog } from "../../src/services/catalog";
import { discoverySchema } from "../../src/services/discovery/types";
import { handleArcGISProxy } from "../../src/server/arcgis-proxy";
import { latestIndex } from "../../src/server/discovery-index";
import { handleProxyRequest } from "../../src/server/proxy-handler";
import { admitProxy } from "../../src/server/proxy-admission";

const datasets = [
  ...parseCatalog(curated).datasets,
  ...discoverySchema.parse(discovered).datasets,
];
export function onRequest(context: { request: Request; env: PagesEnv }) {
  return handleProxyRequest(context.request, {
    bundled: datasets,
    index: latestIndex,
    admit: (request) => admitProxy(request, context.env),
    forward: handleArcGISProxy,
  });
}
