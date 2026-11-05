import { test, expect } from "@playwright/test";
test("search, choose a dataset, preview and export a loaded page", async ({
  page,
}) => {
  const arcgisRequests: string[] = [];
  await page.route("**/FeatureServer/**", async (route) => {
    const url = new URL(route.request().url());
    arcgisRequests.push(url.href);
    if (url.pathname.endsWith("/query"))
      await route.fulfill({
        json: {
          features: [
            {
              attributes: { OBJECTID: 1, NAME: "Civic sample" },
              geometry: { x: -82.45, y: 27.95 },
            },
          ],
          spatialReference: { wkid: 4326 },
          exceededTransferLimit: false,
        },
      });
    else
      await route.fulfill({
        json: {
          fields: [
            { name: "OBJECTID", type: "esriFieldTypeOID" },
            { name: "NAME", type: "esriFieldTypeString" },
          ],
          geometryType: "esriGeometryPoint",
          objectIdField: "OBJECTID",
          capabilities: "Query",
          maxRecordCount: 1000,
          advancedQueryCapabilities: {
            supportsPagination: true,
            supportsOrderBy: true,
          },
        },
      });
  });
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("52");
  await page.screenshot({
    path: "test-results/homepage-desktop.png",
    fullPage: false,
  });
  await page.getByRole("searchbox", { name: "Search datasets" }).fill("permit");
  await expect(page.locator(".dataset-card").first()).toBeVisible();
  expect(arcgisRequests).toHaveLength(0);
  await page
    .getByRole("combobox", { name: /Publisher/ })
    .selectOption("City of Tampa");
  await page
    .getByRole("link", { name: "Permits (active GIS view)", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Permits (active GIS view)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Civic sample" })).toBeVisible();
  await expect(page.getByText("Map ready · 1 loaded features")).toBeVisible();
  await page.locator(".map canvas").click();
  await expect(page.getByText("Selected feature attributes")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Page CSV", exact: false }).click();
  expect((await downloaded).suggestedFilename()).toContain(".csv");
  await expect(
    page.getByRole("button", { name: "Page GeoJSON", exact: false }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Next →" })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Explore the data" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/detail-mobile.png",
    fullPage: true,
  });
});
