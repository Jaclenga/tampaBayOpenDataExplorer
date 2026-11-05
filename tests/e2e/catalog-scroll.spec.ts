import { test, expect, type Page } from "@playwright/test";
import { installApi } from "./helpers";
import { dataset } from "../fixtures";
import { emptyDiscovery } from "../discovery-fixture";
async function installDirectory(page: Page) {
  await installApi(page);
  const datasets = Array.from({ length: 60 }, (_, i) => ({
    ...dataset,
    id: `arcgis:${"e".repeat(32)}:${i + 10}`,
    layerId: i + 10,
    title: `Directory dataset ${String(i).padStart(3, "0")}`,
    description: "Current public dataset.",
    category: i % 2 ? "Recreation" : "Transportation",
    validationStatus: "discovered",
  }));
  await page.route("**/api/discovery", (r) =>
    r.fulfill({ json: { ...emptyDiscovery, datasets } }),
  );
}
test("desktop rows fit the density target and sticky filters stop before the footer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installDirectory(page);
  await page.goto("/#catalog");
  await expect(page.locator(".dataset-card")).toHaveCount(63);
  const boxes = await page
    .locator(".dataset-card")
    .evaluateAll((rows) =>
      rows
        .slice(0, 10)
        .map((e) => ({
          top: e.getBoundingClientRect().top,
          bottom: e.getBoundingClientRect().bottom,
          height: e.getBoundingClientRect().height,
        })),
    );
  for (let i = 0; i < boxes.length; i++) {
    expect(boxes[i].height).toBeGreaterThanOrEqual(75);
    expect(boxes[i].height).toBeLessThanOrEqual(100);
    if (i) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom - 1);
  }
  expect(
    boxes.filter((b) => b.top >= 0 && b.bottom <= 900).length,
  ).toBeGreaterThanOrEqual(7);
  await expect(
    page
      .locator(".dataset-card")
      .first()
      .getByRole("link", { name: /View dataset:/ }),
  ).toBeVisible();
  const height = (await page.locator("aside").boundingBox())!.height;
  expect(height).toBeLessThan(400);
  await page.evaluate(() => window.scrollTo(0, 1300));
  expect((await page.locator("aside").boundingBox())!.y).toBeCloseTo(24, 0);
  expect(
    await page.locator("aside").evaluate((e) => getComputedStyle(e).overflowY),
  ).toBe("visible");
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  expect(
    (await page.locator("aside").boundingBox())!.y + height,
  ).toBeLessThanOrEqual((await page.locator("footer").boundingBox())!.y);
});
test("expansion, collapse, search submission, sorting and filters preserve document scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installDirectory(page);
  await page.goto("/#catalog");
  const row = page.locator(".dataset-card").nth(12);
  await row.waitFor();
  await row.evaluate((e) =>
    window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 120),
  );
  const y = await page.evaluate(() => window.scrollY);
  const toggle = row.getByRole("button", { name: /Show details/ });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(
    row.getByRole("button", { name: /Hide details/ }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - y),
  ).toBeLessThanOrEqual(2);
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - y),
  ).toBeLessThanOrEqual(2);
  await page
    .locator("#catalog")
    .evaluate((e) =>
      window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 24),
    );
  const top = await page.evaluate(() => window.scrollY);
  await page.getByRole("searchbox").fill("Directory");
  await page.getByRole("searchbox").press("Enter");
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - top),
  ).toBeLessThanOrEqual(2);
  await page
    .getByRole("combobox", { name: "Sort by" })
    .selectOption("name-desc");
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - top),
  ).toBeLessThanOrEqual(2);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Transportation");
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - top),
  ).toBeLessThanOrEqual(2);
});
for (const width of [768, 390])
  test(`filters collapse and rows remain usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await installDirectory(page);
    await page.goto("/#catalog");
    await expect(
      page.getByRole("combobox", { name: "Publisher", exact: true }),
    ).not.toBeVisible();
    const filters = page.getByRole("button", { name: /Show filters/ });
    await filters.click();
    await expect(
      page.getByRole("combobox", { name: "Publisher", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Hide filters/ }).click();
    const row = page.locator(".dataset-card").nth(2);
    await row.getByRole("button", { name: /Show details/ }).click();
    await expect(
      row.getByText("Dataset identifier", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
