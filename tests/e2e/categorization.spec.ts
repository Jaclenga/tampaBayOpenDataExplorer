import { test, expect } from "@playwright/test";
import { installApi } from "./helpers";
import discovery from "../../public/discovery.json" with { type: "json" };
import { emptyDiscovery } from "../discovery-fixture";

test("real discovered categories filter normally and reveal provenance only in details", async ({
  page,
}) => {
  const { queries } = await installApi(page);
  const dataset = discovery.datasets.find(
    (d) => d.title === "Public Transit Active Routes",
  )!;
  await page.route("**/api/discovery", (route) =>
    route.fulfill({ json: { ...emptyDiscovery, datasets: [dataset] } }),
  );
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Transportation");
  const row = page.locator(".dataset-card").filter({
    has: page.getByRole("heading", { name: dataset.title, exact: true }),
  });
  await expect(row).toBeVisible();
  await expect(row.locator(".dataset-meta")).toContainText("Transportation");
  await expect(
    row.getByText("Category assignment", { exact: true }),
  ).toHaveCount(0);
  await row.getByRole("button", { name: /Show details/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Category (catalog)");
  await expect(page.getByRole("dialog")).toContainText("Transportation");
  await page.keyboard.press("Escape");
  expect(queries).toHaveLength(0);
  await page
    .getByRole("button", { name: "Clear all filters", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Category", exact: true }),
  ).toHaveValue("");
});
