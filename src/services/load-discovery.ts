import { discoverySchema, type DiscoveryReport } from "./discovery/types";
export async function loadDiscovery(
  base: string,
  signal: AbortSignal,
): Promise<{ report: DiscoveryReport; warning: string | null }> {
  for (const path of ["api/discovery", "discovery.json"]) {
    try {
      const response = await fetch(`${base}${path}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
      if (!response.ok) throw Error("Discovery unavailable");
      const report = discoverySchema.parse(await response.json());
      return {
        report,
        warning:
          path === "discovery.json" ||
          response.headers.get("X-Catalog-Index") === "bundled-fallback"
            ? "Showing the bundled discovery index; the latest scheduled index could not be reached."
            : null,
      };
    } catch {
      signal.throwIfAborted();
    }
  }
  return {
    report: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      lastSuccessfulRunAt: null,
      complete: false,
      datasets: [],
      runs: [],
    },
    warning:
      "Discovery is temporarily unavailable. The curated catalog remains available.",
  };
}
