import { test, expect } from "@playwright/test";
import { installApi } from "./helpers";

test("metadata drawer traps focus, restores search state, caches metadata and separates exploration", async ({
  page,
}) => {
  const api = await installApi(page, {
    metadata: {
      description: "<p>Original publisher description</p>",
      copyrightText: "City attribution",
      fields: [
        {
          name: "OBJECTID",
          type: "esriFieldTypeOID",
          description: "Publisher field description",
        },
      ],
    },
  });
  let requests = 0;
  page.on("request", (request) => {
    if (
      request.url().includes("FeatureServer/0?") &&
      !request.url().includes("query")
    )
      requests++;
  });
  await page.goto("/?q=parks&publisher=Test+City");
  const trigger = page.getByRole("button", { name: /Show details/ });
  const url = page.url();
  const scroll = await page.evaluate(() => scrollY);
  await trigger.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("Original publisher description");
  await expect(drawer).toContainText("City attribution");
  await expect(
    page.getByRole("button", { name: "Close dataset details" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    drawer.getByRole("link", { name: "Explore dataset" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close dataset details" }),
  ).toBeFocused();
  await drawer.getByText(/Fields & schema/).click();
  await expect(drawer).toContainText("Publisher field description");
  expect(api.queries).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await trigger.click();
  await expect(drawer).toContainText("Original publisher description");
  expect(requests).toBe(1);
  await page.mouse.click(2, 200);
  await expect(drawer).toHaveCount(0);
  await trigger.click();
  await drawer.getByRole("link", { name: "Explore dataset" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Neighborhood parks" }),
  ).toBeVisible();
});

test("mobile drawer handles unavailable metadata without inventing source values", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page, { metadata: { fields: null } });
  await page.goto("/?q=parks");
  await page.getByRole("button", { name: /Show details/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("status")).toContainText(
    "Publisher metadata is unavailable",
  );
  await expect(
    drawer.getByRole("button", { name: "Retry metadata" }),
  ).toBeVisible();
  const box = await drawer.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(
    await drawer.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Close dataset details" }).click();
  await expect(drawer).toHaveCount(0);
});
