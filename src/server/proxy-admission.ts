import { ProxyError } from "./proxy-policy";
import type { Admission } from "./request-budget";

export async function admitProxy(request: Request, env: PagesEnv) {
  try {
    if (!env.PROXY_GUARD) throw Error("Missing request guard binding");
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) throw Error("Missing trusted client identity");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(ip),
    );
    const client = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const gate = env.PROXY_GUARD.getByName("arcgis-global-v1");
    const response = await gate.fetch("https://guard/acquire", {
      method: "POST",
      body: JSON.stringify({ client }),
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw Error("Request guard unavailable");
    const admission = (await response.json()) as Admission;
    if (!admission.allowed)
      throw new ProxyError(
        "Preview request budget reached. Please try again shortly.",
        429,
        admission.retryAfter,
      );
    const token = admission.token;
    return async () => {
      try {
        const released = await gate.fetch("https://guard/release", {
          method: "POST",
          body: JSON.stringify({ token }),
          signal: AbortSignal.timeout(2000),
        });
        await released.body?.cancel();
      } catch {
        console.warn(JSON.stringify({ event: "proxy_lease_release_failed" }));
      }
    };
  } catch (error) {
    if (error instanceof ProxyError) throw error;
    throw new ProxyError(
      "Preview protection is temporarily unavailable. Please try again later.",
      503,
      5,
    );
  }
}
