import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { datasetSchema, type Dataset } from "../../src/types";
import { catalog, accessReport, layerResponse, record } from "../fixtures";
import { emptyDiscovery } from "../discovery-fixture";
import { installApi } from "./helpers";
const checked = datasetSchema.parse(
  (
    JSON.parse(readFileSync("public/catalog.json", "utf8"))
      .datasets as Dataset[]
  ).find((d) => d.id === "tampa/construction-permits"),
);
const hart = datasetSchema.parse(
  (
    JSON.parse(readFileSync("public/discovery.json", "utf8"))
      .datasets as Dataset[]
  ).find((d) => d.title === "HART Stops"),
);
async function installDataset(
  page: Page,
  dataset: Dataset,
  isChecked = true,
  sourceOnly = false,
) {
  await installApi(page);
  if (isChecked) {
    await page.route("**/catalog.json", (route) =>
      route.fulfill({ json: { ...catalog, datasets: [dataset] } }),
    );
    await page.route("**/access.json", (route) =>
      route.fulfill({
        json: {
          ...accessReport,
          datasets: [
            {
              ...accessReport.datasets[0],
              id: dataset.id,
              endpoint: `${dataset.serviceUrl}/${dataset.layerId}`,
              status: sourceOnly ? "source-only" : "available",
              stage: sourceOnly ? "metadata" : "complete",
              reason: sourceOnly ? "Token required" : null,
              recordCount: sourceOnly ? null : 1,
            },
          ],
        },
      }),
    );
  } else
    await page.route("**/api/discovery", (route) =>
      route.fulfill({ json: { ...emptyDiscovery, datasets: [dataset] } }),
    );
  await page.route("**/FeatureServer/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/query")
        ? {
            features: [record(1)],
            spatialReference: { wkid: 4326 },
            exceededTransferLimit: false,
          }
        : layerResponse,
    }),
  );
  await page.goto("/#" + encodeURIComponent(dataset.id));
  await page.getByRole("tab", { name: "Use in R", exact: true }).click();
}
test("checked package ID, full/spatial examples, successful copy, and preserved preview", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          sessionStorage.setItem("copied-r-code", text);
        },
      },
    });
  });
  await installDataset(page, checked);
  const code = page.getByRole("textbox", { name: "R code", exact: true });
  await expect(code).toHaveValue(
    /tbod_get_dataset\("construction-permits", limit = 100\)/,
  );
  await page.getByRole("checkbox", { name: /Full retrieval/ }).check();
  await expect(page.getByRole("note")).toContainText("Large dataset warning");
  await page.getByRole("checkbox", { name: /Spatial data/ }).check();
  await expect(code).toHaveValue(/limit = Inf, spatial = TRUE/);
  await page.getByRole("button", { name: "Copy Code", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "R code copied." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("copied-r-code")),
  ).toBe(await code.inputValue());
  await page.getByRole("tab", { name: "Preview & map", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Park 1", exact: true }),
  ).toBeVisible();
  const canvas = page.locator(".map canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => canvas.evaluate((element) => element.clientWidth))
    .toBe(
      await page.locator(".map").evaluate((element) => element.clientWidth),
    );
});
test("real discovered URL, copy failure selection, keyboard tabs, and narrow layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error("Denied");
        },
      },
    });
  });
  await installDataset(page, hart, false);
  const code = page.getByRole("textbox", { name: "R code", exact: true });
  await expect(code).toHaveValue(new RegExp("tbod_get_arcgis_layer"));
  expect(await code.inputValue()).toContain(
    `${hart.serviceUrl}/${hart.layerId}`,
  );
  await page.getByRole("button", { name: "Copy Code", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Could not copy automatically" }),
  ).toBeVisible();
  await expect(code).toBeFocused();
  expect(
    await code.evaluate(
      (element: HTMLTextAreaElement) =>
        element.selectionEnd - element.selectionStart,
    ),
  ).toBe((await code.inputValue()).length);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Use in R", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("tab", { name: "Preview & map", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("textbox", { name: "R code", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/use-in-r-mobile.png",
    fullPage: true,
  });
});
test("unsupported sources have a clear explanation and no copy button", async ({
  page,
}) => {
  await installDataset(
    page,
    {
      ...hart,
      platform: "csv",
      serviceUrl: null,
      layerId: null,
      resource: { url: "https://data.example.test/file.csv" },
    },
    false,
  );
  await expect(
    page.getByText(/This source platform is not supported/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy Code", exact: true }),
  ).toHaveCount(0);
});
test("Use in R remains available on source-only pages", async ({ page }) => {
  const restricted = datasetSchema.parse(
    (
      JSON.parse(readFileSync("public/catalog.json", "utf8"))
        .datasets as Dataset[]
    ).find((d) => d.id === "clearwater/clearwater-critical-assets"),
  );
  await installDataset(page, restricted, true, true);
  await expect(
    page.getByRole("textbox", { name: "R code", exact: true }),
  ).toHaveValue(/tbod_get_dataset/);
  await expect(
    page.getByText(
      /Publisher availability and access restrictions still apply/,
    ),
  ).toBeVisible();
});
