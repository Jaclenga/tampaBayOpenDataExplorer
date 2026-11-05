import bundled from "../../public/discovery.json";
import portals from "../../config/portals.json";
import {
  discoverySchema,
  type DiscoveryReport,
} from "../services/discovery/types";
import { endpointAllowed } from "../services/source-url";
import { boundedText } from "../services/bounded-response";

// Fixed public metadata artifact. No caller-controlled host or URL is accepted.
export const indexURL =
  "https://raw.githubusercontent.com/Jaclenga/tampaBayOpenDataExplorer/main/public/discovery.json";
export function validateIndex(value: unknown): DiscoveryReport {
  const report = discoverySchema.parse(value);
  for (const dataset of report.datasets) {
    const portal = portals.find((p) => p.id === dataset.portalId);
    if (
      !portal ||
      !(
        dataset.platform === portal.platform ||
        (portal.platform === "ckan" &&
          ["csv", "json"].includes(dataset.platform ?? ""))
      ) ||
      !endpointAllowed(
        dataset.resource?.url.split("?")[0] ??
          `${dataset.serviceUrl}/${dataset.layerId}`,
        portal.servicePrefixes,
      )
    )
      throw Error("Discovery index contains an unregistered source.");
  }
  return report;
}
export async function latestIndex(
  signal?: AbortSignal,
  upstream: typeof fetch = fetch,
) {
  try {
    const cache =
      typeof caches === "undefined"
        ? undefined
        : await caches.open("discovery-v1");
    const cached = await cache?.match(indexURL);
    if (cached)
      return { report: validateIndex(await cached.json()), fallback: false };
    const response = await upstream(indexURL, {
      redirect: "error",
      credentials: "omit",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
        : AbortSignal.timeout(5000),
    });
    if (!response.ok) throw Error(`Index HTTP ${response.status}`);
    const report = validateIndex(
      JSON.parse(await boundedText(response, 4194304)),
    );
    await cache?.put(
      indexURL,
      Response.json(report, {
        headers: { "Cache-Control": "public, max-age=300" },
      }),
    );
    return { report, fallback: false };
  } catch {
    console.warn(JSON.stringify({ event: "discovery_index_fallback" }));
    return { report: validateIndex(bundled), fallback: true };
  }
}
