import { test, expect } from "@playwright/test";
import { installApi } from "./helpers";

test("mobile discovery and table preview fit the viewport", async ({
  page,
}) => {
  await installApi(page);
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Data type", exact: true })
    .selectOption("nonspatial");
  await page
    .getByRole("link", { name: "Budget allocations", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Oak Park", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Page CSV/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
