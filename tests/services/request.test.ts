import { describe, expect, it, vi } from "vitest";
import { requestJson } from "../../src/services/arcgis";

const url = "https://api.example.test/layer?f=json";
describe("HTTP response and retry contracts", () => {
  it("recovers from transient failure using exponential backoff", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const pending = requestJson(url);
    await vi.advanceTimersByTimeAsync(399);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(799);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it.each([400, 401, 403, 404])(
    "does not retry permanent HTTP %i",
    async (status) => {
      vi.mocked(fetch).mockResolvedValue(new Response("", { status }));
      await expect(requestJson(url)).rejects.toThrow(String(status));
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
  it("retries ArcGIS transient errors even with HTTP 200", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        Response.json({ error: { code: 503, message: "Busy" } }),
      )
      .mockResolvedValueOnce(Response.json({ features: [] }));
    const pending = requestJson(url);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ features: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([
    ["invalid JSON", () => new Response("<html>maintenance</html>")],
    ["malformed error", () => Response.json({ error: { message: "No code" } })],
  ])("reports %s without retrying", async (_name, response) => {
    vi.mocked(fetch).mockResolvedValue(response());
    await expect(requestJson(url)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("passes a working timeout signal to fetch", async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          const signal = options?.signal;
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    // Timeout signals use native timers, so do not replace them with fake timers.
    await expect(requestJson(url, undefined, 5)).rejects.toThrow("timed out");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("cancels retry backoff immediately on navigation", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 503 }));
    const pending = requestJson(url, controller.signal);
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await assertion;
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
