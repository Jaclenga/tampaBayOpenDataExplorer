export function canonicalEndpoint(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  )
    throw Error(
      "A public HTTPS endpoint without credentials or query parameters is required.",
    );
  const segments = url.pathname.split("/");
  if (
    segments.some(
      (segment) =>
        /[\\/%]/.test(decodeURIComponent(segment)) ||
        [".", ".."].includes(decodeURIComponent(segment)),
    )
  )
    throw Error("Encoded or traversing source paths are not allowed.");
  // ArcGIS's fixed REST prefix is case insensitive. Preserve service-name case.
  url.pathname = url.pathname
    .replace(/\/arcgis\/rest\/services(?=\/|$)/i, "/arcgis/rest/services")
    .replace(/\/+$/, "");
  return url.href;
}

export function endpointAllowed(endpoint: string, prefixes: readonly string[]) {
  try {
    const normalized = canonicalEndpoint(endpoint);
    return prefixes.some((prefix) => {
      const base = canonicalEndpoint(prefix).replace(/\/+$/, "");
      return (
        (normalized === base || normalized.startsWith(base + "/")) &&
        new URL(normalized).origin === new URL(base).origin
      );
    });
  } catch {
    return false;
  }
}
