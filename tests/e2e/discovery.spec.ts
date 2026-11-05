import { test, expect } from "@playwright/test";
import { installApi } from "./helpers";

test("search and filters intersect, reset, and never request records", async ({
  page,
}) => {
  const api = await installApi(page);
  await page.goto("/");
  await expect(page.locator(".dataset-card")).toHaveCount(3);
  await page.getByRole("link", { name: "Explore the collection" }).click();
  await expect(page.locator(".dataset-card")).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Publisher", exact: true })
    .selectOption("Test City");
  await expect(page.locator(".dataset-card")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Finance");
  await expect(
    page.getByRole("heading", { name: "No datasets match these filters." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("searchbox").fill("gardens");
  await expect(page.locator(".dataset-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset all" }).click();
  await page
    .getByRole("combobox", { name: "Data type", exact: true })
    .selectOption("nonspatial");
  await expect(
    page.getByRole("link", { name: "Budget allocations", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dataset-card")).toHaveCount(1);
  expect(api.queries).toHaveLength(0);
});

test("invalid catalog fails visibly instead of showing a partial collection", async ({
  page,
}) => {
  await installApi(page);
  await page.route("**/catalog.json", (route) =>
    route.fulfill({ json: { datasets: [] } }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".dataset-card")).toHaveCount(0);
});

test("unknown dataset route has a working return link", async ({ page }) => {
  await installApi(page);
  await page.goto("/#missing%2Fdataset");
  await expect(
    page.getByRole("heading", { name: "Dataset not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return to the catalog" }).click();
  await expect(page.locator(".dataset-card")).toHaveCount(3);
});

test("keyboard skip link focuses the current detail page without changing routes", async ({
  page,
}) => {
  await installApi(page);
  await page.goto("/#county%2Fbudget");
  await expect(
    page.getByRole("heading", { name: "Budget allocations", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Budget allocations", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#county%2Fbudget$/);
});
