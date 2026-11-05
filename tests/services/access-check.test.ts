import { describe, expect, it, vi } from "vitest";
import {
  accessExplanation,
  checkPreviewAccess,
} from "../../src/services/access-check";
import { dataset, layerResponse, record } from "../fixtures";

describe("publisher access explanations", () => {
  it.each([
    ["Your browser is offline.", "connection"],
    ["ArcGIS 499: Token Required", "restricted"],
    ["HTTP 401 Unauthorized", "restricted"],
    ["Publisher HTTP 403", "restricted"],
    ["The publisher timed out", "timeout"],
    ["TimeoutError: timeout", "timeout"],
    ["HTTP 408", "timeout"],
    ["Publisher returned HTTP 503.", "offline"],
    ["ArcGIS 500: Server Error", "offline"],
    [
      "Browser request failed: the publisher may block cross-origin access or be unreachable.",
      "browser",
    ],
    ["Cannot reach the publisher (CORS).", "browser"],
    ["Publisher blocked browser access.", "browser"],
    ["Query capability is unavailable", "unsupported"],
    ["Unsupported layer schema", "unsupported"],
  ])("explains %s without assuming the wrong failure cause", (reason, kind) => {
    const result = accessExplanation(reason);
    expect(result.kind).toBe(kind);
    expect(result.nextStep.length).toBeGreaterThan(20);
  });
  it("does not claim that an ambiguous network error proves a CORS restriction", () => {
    expect(accessExplanation("Browser request failed").description).toContain(
      "cannot reliably distinguish",
    );
  });
});

describe("explicit bounded access rechecks", () => {
  it("does not contact publishers when the browser reports being offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await expect(
      checkPreviewAccess(dataset, new AbortController().signal),
    ).rejects.toThrow("browser is offline");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("checks metadata and only one record using the normal query validator", async () => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      Response.json(
        String(input).includes("/query?")
          ? {
              features: [record(1)],
              spatialReference: { wkid: 4326 },
              exceededTransferLimit: true,
            }
          : layerResponse,
      ),
    );
    const controller = new AbortController();
    await checkPreviewAccess(dataset, controller.signal);
    expect(fetch).toHaveBeenCalledTimes(2);
    const query = new URL(vi.mocked(fetch).mock.calls[1][0] as string);
    expect(query.searchParams.get("resultRecordCount")).toBe("1");
  });
  it("does not treat metadata success as proof that queries work", async () => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      Response.json(
        String(input).includes("/query?")
          ? { error: { code: 499, message: "Token Required" } }
          : layerResponse,
      ),
    );
    await expect(
      checkPreviewAccess(dataset, new AbortController().signal),
    ).rejects.toThrow("499");
  });
  it("rejects oversized probe responses", async () => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      Response.json(
        String(input).includes("/query?")
          ? { features: [record(1), record(2)] }
          : layerResponse,
      ),
    );
    await expect(
      checkPreviewAccess(dataset, new AbortController().signal),
    ).rejects.toThrow("preview limit");
  });
  it("accepts an empty but accessible dataset", async () => {
    vi.mocked(fetch).mockImplementation(async (input) =>
      Response.json(
        String(input).includes("/query?")
          ? { features: [], exceededTransferLimit: false }
          : layerResponse,
      ),
    );
    await expect(
      checkPreviewAccess(dataset, new AbortController().signal),
    ).resolves.toBeUndefined();
  });
  it("does not issue requests after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      checkPreviewAccess(dataset, controller.signal),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
