import { test, expect } from "@playwright/test";
import { installApi } from "./helpers";
const title = "Explore public data across Tampa Bay.";
const subtitle =
  "Discover and access public datasets from local governments across the Tampa Bay region.";
for (const width of [1440, 768, 390, 320]) {
  test(`text-only civic header fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installApi(page);
    await page.goto("/");
    const hero = page.locator(".hero");
    const heading = hero.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText(title);
    await expect(hero.locator("p")).toHaveText(subtitle);
    await expect(heading.locator("span")).toHaveText("Tampa Bay.");
    await expect(heading).toHaveCSS(
      "font-size",
      width <= 740 ? "32px" : "42px",
    );
    await expect(heading).toHaveCSS("font-weight", "700");
    await expect(
      hero.locator("img,svg,canvas,video,iframe,form,input"),
    ).toHaveCount(0);
    await expect(hero).toHaveCSS("background-image", "none");
    await expect(page.getByRole("searchbox")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440) {
      const height =
        (await page.locator("header").boundingBox())!.height +
        (await hero.boundingBox())!.height;
      expect(height).toBeGreaterThanOrEqual(160);
      expect(height).toBeLessThanOrEqual(190);
    }
    if (width === 1440 || width === 390)
      await page.screenshot({ path: `test-results/hero-after-${width}.png` });
  });
}
test("header navigation supports keyboard use and leaves search in the catalog", async ({
  page,
}) => {
  await installApi(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(
    nav.getByRole("link", { name: "GitHub", exact: true }),
  ).toHaveAttribute("href", "https://github.com/Jaclenga/tbdataexplorer");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const browse = nav.getByRole("link", { name: "Browse data" });
  await expect(browse).toBeFocused();
  await expect(browse).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#catalog$/);
  await expect(
    page.getByRole("heading", { name: "Browse datasets", exact: true }),
  ).toBeInViewport();
  await expect(page.locator("#catalog").getByRole("searchbox")).toHaveCount(1);
});
