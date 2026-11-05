import type { Dataset } from "../types";
import type { DiscoveryReport } from "../services/discovery/types";
import { validateProxyRequest } from "./proxy-policy";
import { proxyFailure } from "./arcgis-proxy";

interface Dependencies {
  bundled: readonly Dataset[];
  index: (signal: AbortSignal) => Promise<{ report: DiscoveryReport }>;
  admit: (request: Request) => Promise<() => Promise<void>>;
  forward: (
    request: Request,
    datasets: readonly Dataset[],
  ) => Promise<Response>;
}
export async function handleProxyRequest(
  request: Request,
  dependencies: Dependencies,
) {
  let release: (() => Promise<void>) | undefined;
  try {
    const { id } = validateProxyRequest(request);
    release = await dependencies.admit(request);
    const registry = new Map(
      dependencies.bundled.map((dataset) => [dataset.id, dataset]),
    );
    if (id.startsWith("arcgis:")) {
      const latest = await dependencies.index(request.signal);
      for (const dataset of latest.report.datasets)
        registry.set(dataset.id, dataset);
    }
    return await dependencies.forward(request, [...registry.values()]);
  } catch (error) {
    return proxyFailure(error);
  } finally {
    if (release) await release();
  }
}
