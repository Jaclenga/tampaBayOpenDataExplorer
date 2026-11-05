import { test, expect } from "@playwright/test";
import { installApi } from "./helpers";
import { accessReport, catalog } from "../fixtures";
test("restrained row metadata, actions, wrapping and genuine failure indicators", async ({
  page,
}) => {
  await installApi(page);
  const report = structuredClone(accessReport);
  report.datasets[0] = {
    ...report.datasets[0],
    status: "source-only",
    stage: "metadata",
    reason: "Publisher HTTP 503",
    recordCount: null,
  };
  await page.route("**/access.json", (r) => r.fulfill({ json: report }));
  await page.goto("/");
  const row = page.locator(".dataset-card").filter({
    has: page.getByRole("heading", {
      name: "Neighborhood parks",
      exact: true,
    }),
  });
  await expect(row.locator(".dataset-meta")).toHaveText(
    "Test City \u00b7 Recreation \u00b7 Point layer",
  );
  await expect(
    row.getByRole("link", { name: "View source: Neighborhood parks" }),
  ).toHaveAttribute("href", "https://data.example.test/parks");
  await expect(row.locator(".catalog-source-error")).toHaveText(
    "Last source check failed",
  );
  const details = row.getByRole("button", { name: /Show details/ });
  await expect(details).toHaveText("Details");
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(row.locator(".catalog-preview-status")).toContainText(
    "Publisher HTTP 503",
  );
  await expect(
    row.getByText("Preview not available", { exact: true }),
  ).toHaveCount(0);
  await expect(row.locator(".catalog-preview-status")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await row.getByRole("button", { name: /Hide details/ }).click();
  await expect(row.locator(".catalog-preview-status")).toHaveCount(0);
});

test("long titles wrap above separated metadata without overlapping actions", async ({
  page,
}) => {
  await installApi(page);
  const title = "Polygon survey " + "long government dataset name ".repeat(10);
  await page.route("**/catalog.json", (route) =>
    route.fulfill({
      json: {
        ...catalog,
        datasets: catalog.datasets.map((d, i) =>
          i ? d : { ...d, title, category: null },
        ),
      },
    }),
  );
  await page.goto("/");
  const row = page
    .locator(".dataset-card")
    .filter({
      has: page.getByRole("heading", { name: title.trim(), exact: true }),
    });
  await expect(row.locator(".dataset-meta")).toHaveText(
    "Test City \u00b7 Point layer",
  );
  const heading = await row.locator("h3").boundingBox();
  const actions = await row.locator(".dataset-row-actions").boundingBox();
  expect(heading!.height).toBeGreaterThan(24);
  expect(heading!.x + heading!.width).toBeLessThanOrEqual(actions!.x);
  await row.getByRole("link", { name: title.trim(), exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: title.trim(), exact: true }),
  ).toBeVisible();
});
