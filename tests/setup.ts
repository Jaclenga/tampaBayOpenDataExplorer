import { afterEach, beforeEach, vi } from "vitest";

// Unit tests must explicitly provide HTTP fixtures. Never contact a publisher.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("Unmocked HTTP request in a unit test");
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
