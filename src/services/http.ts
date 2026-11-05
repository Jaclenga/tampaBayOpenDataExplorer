import { z } from "zod";

export class ArcGISError extends Error {
  readonly networkFailure: boolean;
  readonly retryAfterMs: number;
  constructor(
    message: string,
    public transient = false,
    options: { networkFailure?: boolean; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = "ArcGISError";
    this.networkFailure = options.networkFailure ?? false;
    this.retryAfterMs = options.retryAfterMs ?? 0;
  }
}

const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);
const errorSchema = z.object({
  error: z.object({ code: z.number(), message: z.string() }),
});

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new ArcGISError(
      `Publisher returned HTTP ${response.status}.`,
      transientStatuses.has(response.status),
      { retryAfterMs: retryAfter(response.headers.get("Retry-After")) },
    );
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("error" in body)) return body;
  const result = errorSchema.safeParse(body);
  if (!result.success)
    throw new ArcGISError("Publisher returned a malformed error.");
  const { code, message } = result.data.error;
  throw new ArcGISError(
    `ArcGIS ${code}: ${message}`,
    code !== 408 && transientStatuses.has(code),
  );
}

function isTimeout(error: unknown) {
  return (
    error instanceof DOMException &&
    ["TimeoutError", "AbortError"].includes(error.name)
  );
}

function requestError(error: unknown) {
  if (isTimeout(error))
    return new ArcGISError("The publisher timed out. Please try again later.");
  if (error instanceof TypeError)
    return new ArcGISError(
      "Cannot reach the publisher. Check your connection; the service may be offline or may block browser requests (CORS). Try the original endpoint.",
      false,
      { networkFailure: true },
    );
  if (error instanceof SyntaxError)
    return new ArcGISError("The publisher did not return valid JSON.");
  return error;
}

export async function requestJson(
  url: string,
  signal?: AbortSignal,
  timeout = 15000,
): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted();
    try {
      const deadline = AbortSignal.timeout(timeout);
      return await fetchJson(
        url,
        signal ? AbortSignal.any([signal, deadline]) : deadline,
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      const retryable =
        isTimeout(error) || (error instanceof ArcGISError && error.transient);
      if (!retryable || attempt === 2) throw requestError(error);
      const wait =
        error instanceof ArcGISError
          ? Math.max(error.retryAfterMs, 400 * 2 ** attempt)
          : 400 * 2 ** attempt;
      if (wait > 5000) throw requestError(error);
      await delay(wait, signal);
    }
  }
  throw new ArcGISError("Request failed.");
}

function retryAfter(value: string | null) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}
