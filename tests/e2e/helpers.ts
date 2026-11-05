import type { Page } from "@playwright/test";
import { emptyDiscovery } from "../discovery-fixture";
import { catalog, accessReport, layerResponse, record } from "../fixtures";

export interface ApiResponse {
  body: unknown;
  status?: number;
}
export interface ApiOptions {
  metadata?: Record<string, unknown>;
  query?: (url: URL, attempt: number) => ApiResponse | Promise<ApiResponse>;
}
export async function installApi(page: Page, options: ApiOptions = {}) {
  const queries: URL[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/discovery.json" || url.pathname === "/api/discovery")
      return route.fulfill({ json: emptyDiscovery });
    if (url.pathname === "/catalog.json")
      return route.fulfill({ json: catalog });
    if (url.pathname === "/access.json")
      return route.fulfill({ json: accessReport });
    if (url.hostname === "data.example.test") {
      if (!url.pathname.endsWith("/query")) {
        const nonspatial = url.pathname.endsWith("/1");
        return route.fulfill({
          json: {
            ...layerResponse,
            ...(nonspatial ? { geometryType: undefined } : {}),
            ...options.metadata,
          },
        });
      }
      queries.push(url);
      if (options.query) {
        const response = await options.query(url, queries.length);
        return route.fulfill({
          status: response.status ?? 200,
          json: response.body,
        });
      }
      const offset = Number(url.searchParams.get("resultOffset") ?? 0);
      const area = url.searchParams.has("geometry");
      const records = area
        ? [record(20, "Filtered park")]
        : offset === 0
          ? [record(1, "Oak Park", -82.45), record(2, "Bay Park", 5)]
          : [record(3, "Cedar Park", 10)];
      return route.fulfill({
        json: {
          features: records.map((r) => ({
            ...r,
            geometry:
              url.searchParams.get("returnGeometry") === "false"
                ? null
                : r.geometry,
          })),
          spatialReference: { wkid: 4326 },
          exceededTransferLimit: !area && offset === 0,
        },
      });
    }
    if (url.hostname === "tile.openstreetmap.org") {
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    }
    // All other external requests are blocked, so CI cannot contact government APIs.
    if (
      url.origin !==
      new URL(page.url() === "about:blank" ? route.request().url() : page.url())
        .origin
    )
      return route.abort("blockedbyclient");
    return route.continue();
  });
  return { queries };
}
export const detailUrl = "/#test%2Fparks";
