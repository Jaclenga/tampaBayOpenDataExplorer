import type { Dataset } from "../types";
import policy from "../../config/proxy.json";
import { ProxyError, proxyTarget } from "./proxy-policy";

export async function handleArcGISProxy(
  request: Request,
  datasets: readonly Dataset[],
  upstream: typeof fetch = fetch,
) {
  let id: string | undefined;
  const started = Date.now();
  try {
    const resolved = proxyTarget(request, datasets);
    id = resolved.datasetId;
    const response = await upstream(resolved.target.href, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(policy.timeoutMs),
      ]),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new ProxyError("Publisher redirects are not followed.", 502);
    }
    const text = await boundedBody(response);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ProxyError("Publisher did not return JSON.", 502);
    }
    validateQueryBody(
      body,
      resolved.operation,
      Number(
        resolved.target.searchParams.get("resultRecordCount") ??
          policy.maxRecords,
      ),
    );
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control":
        response.ok &&
        resolved.operation === "metadata" &&
        !hasSourceError(body)
          ? "public, max-age=60"
          : "no-store",
      "X-Data-Transport": "allowlisted-proxy",
    });
    const retry = response.headers.get("Retry-After");
    if (retry) headers.set("Retry-After", retry);
    console.log(
      JSON.stringify({
        event: "arcgis_proxy",
        dataset: id,
        status: response.status,
        durationMs: Date.now() - started,
      }),
    );
    return new Response(JSON.stringify(body), {
      status: response.status,
      headers,
    });
  } catch (error) {
    const status = error instanceof ProxyError ? error.status : 504;
    console.error(
      JSON.stringify({
        event: "arcgis_proxy_error",
        dataset: id,
        status,
        durationMs: Date.now() - started,
      }),
    );
    return proxyFailure(error);
  }
}

export function proxyFailure(error: unknown) {
  const status = error instanceof ProxyError ? error.status : 504;
  const message =
    error instanceof ProxyError
      ? error.message
      : "Publisher request failed or timed out.";
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (error instanceof ProxyError && error.retryAfter > 0)
    headers.set("Retry-After", String(error.retryAfter));
  return Response.json(
    { error: { code: status, message } },
    { status, headers },
  );
}

async function boundedBody(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > policy.maxResponseBytes)
        throw new ProxyError(
          "Publisher response exceeds the safe preview size; narrow the map or filters.",
          413,
        );
      chunks.push(next.value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function hasSourceError(value: unknown) {
  return !!value && typeof value === "object" && "error" in value;
}
function validateQueryBody(value: unknown, operation: string, limit: number) {
  if (
    operation !== "query" ||
    !value ||
    typeof value !== "object" ||
    !("features" in value)
  )
    return;
  if (!Array.isArray(value.features) || value.features.length > limit)
    throw new ProxyError("Publisher ignored the preview record limit.", 502);
}
