import { test, expect, type Page } from "@playwright/test";
import { installApi } from "./helpers";
import { dataset } from "../fixtures";
import { emptyDiscovery } from "../discovery-fixture";
async function directory(page: Page) {
  await installApi(page);
  const datasets = Array.from({ length: 120 }, (_, i) => ({
    ...dataset,
    id: `directory:${i}`,
    packageId: `external-${i}`,
    layerId: i + 10,
    title: `Directory ${String(i).padStart(3, "0")}`,
    publisher: i % 2 ? "Bay City" : "Test City",
    category: i % 2 ? "Transportation" : "Recreation",
    validationStatus: "discovered",
  }));
  await page.route("**/api/discovery", (r) =>
    r.fulfill({ json: { ...emptyDiscovery, datasets } }),
  );
}
const rows = (page: Page) => page.locator(".dataset-card");
const next = (page: Page) =>
  page.getByRole("button", { name: "Next", exact: true });
const size = (page: Page) =>
  page.getByRole("combobox", { name: "Rows per page:" });
test("page sizes, counts, navigation, URL/detail restoration and expansion cleanup", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await directory(page);
  await page.goto("/");
  await expect(rows(page)).toHaveCount(20);
  await expect(
    page.getByRole("status").filter({ hasText: "Showing" }),
  ).toHaveText("Showing 1\u201320 of 123 datasets");
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Show more datasets/ }),
  ).toHaveCount(0);
  const historyLength = await page.evaluate(() => history.length);
  await size(page).selectOption("10");
  await next(page).click();
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByText("Page 2 of 13", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  const row = rows(page).first();
  await row.getByRole("button", { name: /Show details/ }).click();
  await page
    .getByRole("link", { name: "Explore dataset", exact: true })
    .click();
  await page.goBack();
  await expect(size(page)).toHaveValue("10");
  await expect(page.getByText("Page 2 of 13", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("link", { name: /All datasets/ })).toBeVisible();
  await page.getByRole("link", { name: /All datasets/ }).click();
  // Hash navigation restores the drawer asynchronously. Wait until it is open
  // before sending Escape, otherwise the key can arrive on the detail page.
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await next(page).click();
  await expect(page.getByRole("button", { name: /Hide details/ })).toHaveCount(
    0,
  );
  const top = await page.locator(".results-bar").boundingBox();
  expect(top!.y).toBeGreaterThanOrEqual(20);
  expect(top!.y).toBeLessThan(30);
  const beforeResize = await page.evaluate(() => scrollY);
  await size(page).selectOption("50");
  expect(
    Math.abs((await page.evaluate(() => scrollY)) - beforeResize),
  ).toBeLessThanOrEqual(2);
  await expect(rows(page)).toHaveCount(50);
  await expect(page.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  await size(page).selectOption("100");
  await expect(rows(page)).toHaveCount(100);
  await next(page).click();
  await expect(rows(page)).toHaveCount(23);
  await expect(next(page)).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Showing" }),
  ).toHaveText("Showing 101\u2013123 of 123 datasets");
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(rows(page)).toHaveCount(100);
  await size(page).selectOption("20");
  await expect(rows(page)).toHaveCount(20);
  await expect(page.getByText("Page 1 of 7", { exact: true })).toBeVisible();
});
test("search, all filters and sort reset pagination after matching", async ({
  page,
}) => {
  await directory(page);
  await page.goto("/?page=3&pageSize=10");
  await page.getByRole("searchbox").fill("Directory");
  await expect(page.getByText("Page 1 of 12", { exact: true })).toBeVisible();
  for (const [name, value] of [
    ["Publisher", "Test City"],
    ["Category", "Recreation"],
    ["Data type", "spatial"],
    ["Source platform", "arcgis"],
  ]) {
    await next(page).click();
    await page.getByRole("combobox", { name, exact: true }).selectOption(value);
    await expect(page.getByText("Page 1 of 6", { exact: true })).toBeVisible();
  }
  await next(page).click();
  await page
    .getByRole("combobox", { name: "Sort by" })
    .selectOption("name-desc");
  await expect(rows(page).first().locator("h3")).toHaveText("Directory 118");
  await expect(page.getByText("Page 1 of 6", { exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("zzzzzzzz-no-results");
  await expect(rows(page)).toHaveCount(0);
  await expect(
    page.getByText("No matching datasets", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Dataset pages" }),
  ).toHaveCount(0);
});
test("direct links clamp pages, preserve unrelated parameters and normalize invalid pagination", async ({
  page,
}) => {
  await directory(page);
  await page.goto("/?page=999&pageSize=50&extra=keep");
  await expect(page.getByText("Page 3 of 3", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/page=3/);
  expect(new URL(page.url()).searchParams.get("extra")).toBe("keep");
  await page.reload();
  await expect(rows(page)).toHaveCount(23);
  await page.goto("/?page=-1&pageSize=999");
  await expect(rows(page)).toHaveCount(20);
  await expect(size(page)).toHaveValue("20");
});
test("single and multiple pages stay compact on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page);
  await page.goto("/");
  await expect(rows(page)).toHaveCount(3);
  await expect(
    page.getByRole("navigation", { name: "Dataset pages" }),
  ).toHaveCount(0);
  await expect(size(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await directory(page);
  await page.goto("/?pageSize=10&page=2");
  await expect(page.getByText("Page 2 of 13", { exact: true })).toBeVisible();
  await next(page).click();
  await expect(page.getByText("Page 3 of 13", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/catalog-pagination-mobile.png" });
});
