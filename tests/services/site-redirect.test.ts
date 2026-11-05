import { describe, expect, it } from "vitest";
import routes from "../../public/_routes.json";
import { legacySiteRedirect } from "../../src/server/site-redirect";

describe("site rename redirects", () => {
  it("routes homepage requests through the redirect middleware", () => {
    expect(routes.include).toContain("/");
    expect(routes.include).toContain("/api/*");
    expect(routes.exclude).not.toContain("/");
  });
  it("moves legacy paths and shared browsing queries to the fixed new origin", () => {
    const response = legacySiteRedirect(
      new Request(
        "https://tampabay-open-data-explorer.pages.dev/?q=parks&sort=verified",
      ),
    );
    expect(response?.status).toBe(308);
    expect(response?.headers.get("Location")).toBe(
      "https://tbdataexplorer.pages.dev/?q=parks&sort=verified",
    );
    expect(
      legacySiteRedirect(
        new Request(
          "https://tampabay-open-data-explorer.pages.dev/api/discovery",
        ),
      )?.headers.get("Location"),
    ).toBe("https://tbdataexplorer.pages.dev/api/discovery");
  });
  it.each([
    "https://tbdataexplorer.pages.dev/",
    "http://localhost:5173/",
    "https://tampabay-open-data-explorer.pages.dev.attacker.test/",
    "https://preview.tbdataexplorer.pages.dev/",
  ])("does not redirect other origins: %s", (url) => {
    expect(legacySiteRedirect(new Request(url))).toBeNull();
  });
  it("cannot turn a double-slash path into an external redirect", () => {
    const response = legacySiteRedirect(
      new Request(
        "https://tampabay-open-data-explorer.pages.dev//attacker.test/path",
      ),
    );
    expect(new URL(response!.headers.get("Location")!).origin).toBe(
      "https://tbdataexplorer.pages.dev",
    );
  });
});
