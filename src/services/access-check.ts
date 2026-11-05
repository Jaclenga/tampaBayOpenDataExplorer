import { ArcGISError } from "./arcgis";
import { getAdapter } from "./adapters";
import type { Dataset } from "../types";

export function accessExplanation(reason: string) {
  if (/browser is offline/i.test(reason)) {
    return {
      kind: "connection",
      title: "Your browser is offline",
      description: "An internet connection is needed to reach the publisher.",
      nextStep: "Reconnect, then check preview availability again.",
    };
  }
  if (
    /\b(401|403|498|499)\b|token required|unauthorized|authentication/i.test(
      reason,
    )
  ) {
    return {
      kind: "restricted",
      title: "The publisher restricts access",
      description:
        "This service requires permission or a publisher-issued sign-in. This site cannot grant access.",
      nextStep:
        "Open the publisher’s site to check its access requirements. Access requests are handled by the publisher.",
    };
  }
  if (/timeout|timed out|\b408\b/i.test(reason)) {
    return {
      kind: "timeout",
      title: "The publisher did not respond in time",
      description: "The service may be busy or temporarily offline.",
      nextStep:
        "Try checking again later, or open the publisher’s source directly.",
    };
  }
  if (/\b5\d\d\b/i.test(reason)) {
    return {
      kind: "offline",
      title: "The publisher’s service is unavailable",
      description:
        "The publisher returned a server error. Your dataset remains in the catalog.",
      nextStep: "Try again later or check the publisher’s site for updates.",
    };
  }
  if (/cors|cross.origin|browser|connection|network|fetch/i.test(reason)) {
    return {
      kind: "browser",
      title: "This browser could not connect to the source",
      description:
        "The source may block requests from other websites, or it may be temporarily unreachable. A browser error cannot reliably distinguish those cases.",
      nextStep:
        "Try opening the source directly. You can also recheck preview availability below.",
    };
  }
  return {
    kind: "unsupported",
    title: "A browser preview is not available",
    description: "The service could not provide a compatible record preview.",
    nextStep:
      "Use the publisher’s source for access and download options, or recheck availability.",
  };
}

// A successful schema request alone does not prove that records are accessible.
// Probe only one record and use the same validation as ordinary previews.
export async function checkPreviewAccess(
  dataset: Dataset,
  signal: AbortSignal,
) {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    throw new ArcGISError(
      "Your browser is offline. Reconnect and check again.",
    );
  const adapter = getAdapter(dataset);
  const metadata = await adapter.inspect(dataset, signal);
  await adapter.page(dataset, metadata, { offset: 0, limit: 1, signal });
}
