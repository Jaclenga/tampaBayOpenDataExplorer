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
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}

export function endpointAllowed(endpoint: string, prefixes: readonly string[]) {
  try {
    const normalized = canonicalEndpoint(endpoint);
    return prefixes.some(
      (prefix) =>
        normalized.startsWith(prefix) &&
        new URL(normalized).origin === new URL(prefix).origin,
    );
  } catch {
    return false;
  }
}
