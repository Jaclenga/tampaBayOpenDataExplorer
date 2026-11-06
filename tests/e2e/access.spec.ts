import { test, expect } from "@playwright/test";
import { accessReport, dataset } from "../fixtures";
import { record } from "../fixtures";
import type { Page } from "@playwright/test";
import { installApi } from "./helpers";

async function sourceOnlyReport(
  page: Page,
  reason = "Browser request failed: source may block cross-origin access.",
) {
  const report = structuredClone(accessReport);
  report.datasets[0] = {
    ...report.datasets[0],
    status: "source-only",
    stage: "metadata",
    reason,
    recordCount: null,
  };
  await page.route("**/access.json", (route) =>
    route.fulfill({ json: report }),
  );
}

test("a recovered publisher can be checked with one record and opened as a regular preview", async ({
  page,
}) => {
  const api = await installApi(page, {
    query: (url) => ({
      body: {
        features: [record(1), record(2)].slice(
          0,
          Number(url.searchParams.get("resultRecordCount")),
        ),
        spatialReference: { wkid: 4326 },
        exceededTransferLimit: false,
      },
    }),
  });
  await sourceOnlyReport(page);
  await page.goto("/#test%2Fparks");
  expect(api.queries).toHaveLength(0);
  await page
    .getByRole("button", { name: "Check preview availability" })
    .click();
  await expect(
    page.getByRole("heading", { name: "The source is responding now" }),
  ).toBeVisible();
  expect(api.queries).toHaveLength(1);
  expect(api.queries[0].searchParams.get("resultRecordCount")).toBe("1");
  await page.getByRole("button", { name: "Open data preview" }).click();
  await expect(
    page.getByRole("cell", { name: "Park 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Data preview", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Page CSV/ })).toBeEnabled();
});

test("restricted-source checks explain permissions and keep publisher options available", async ({
  page,
}) => {
  const api = await installApi(page, {
    metadata: { error: { code: 499, message: "Token Required" } },
  });
  await sourceOnlyReport(page);
  await page.goto("/#test%2Fparks");
  await page
    .getByRole("button", { name: "Check preview availability" })
    .click();
  await expect(
    page.getByRole("heading", { name: "The publisher restricts access" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check preview availability" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "Open publisher source" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open data preview" }),
  ).toHaveCount(0);
  expect(api.queries).toHaveLength(0);
});

test("the access panel and clipboard fallback work on a narrow screen without overlap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard permission denied");
        },
      },
    }),
  );
  await installApi(page);
  await sourceOnlyReport(page);
  await page.goto("/#test%2Fparks");
  await page.getByRole("button", { name: "Copy endpoint" }).click();
  const field = page.getByRole("textbox", { name: "ArcGIS layer endpoint" });
  await expect(field).toBeFocused();
  await expect(
    page.getByText("Select and copy the endpoint address below."),
  ).toBeVisible();
  expect(
    await field.evaluate(
      (element: HTMLInputElement) =>
        element.selectionEnd === element.value.length &&
        element.selectionStart === 0,
    ),
  ).toBe(true);
  await page.getByText("Check details", { exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const date = await page.locator(".access-date").boundingBox();
  const actions = await page.locator(".access-actions").boundingBox();
  expect(date).not.toBeNull();
  expect(actions).not.toBeNull();
  expect(actions!.y).toBeGreaterThanOrEqual(date!.y + date!.height);
  await page.screenshot({
    path: "test-results/access-panel-mobile.png",
    fullPage: true,
  });
});

test("leaving a pending availability check aborts its request", async ({
  page,
}) => {
  await installApi(page);
  await sourceOnlyReport(page);
  await page.route("**/FeatureServer/0?f=json", () => {});
  await page.goto("/#test%2Fparks");
  const requested = page.waitForRequest((request) =>
    request.url().includes("/FeatureServer/0?f=json"),
  );
  await page
    .getByRole("button", { name: "Check preview availability" })
    .click();
  await requested;
  await expect(
    page.getByRole("button", { name: "Checking availability…" }),
  ).toBeDisabled();
  const aborted = page.waitForEvent("requestfailed", {
    predicate: (request) => request.url().includes("/FeatureServer/0?f=json"),
  });
  await page.getByRole("link", { name: "All datasets", exact: false }).click();
  await aborted;
  await expect(
    page.getByRole("heading", { name: "Browse datasets", exact: true }),
  ).toBeVisible();
});

test("source-only datasets remain discoverable and link to the publisher without record requests", async ({
  page,
}) => {
  const api = await installApi(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "data.example.test")
      requests.push(request.url());
  });
  const report = structuredClone(accessReport);
  report.datasets[0] = {
    ...report.datasets[0],
    status: "source-only",
    stage: "metadata",
    reason: "Publisher blocked browser access.",
    recordCount: null,
  };
  await page.route("**/access.json", (route) =>
    route.fulfill({ json: report }),
  );
  await page.goto("/");
  await expect(page.locator(".dataset-card")).toHaveCount(3);
  const row = page
    .locator(".dataset-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Neighborhood parks",
        exact: true,
      }),
    });
  await expect(
    row.getByRole("link", {
      name: "View source: Neighborhood parks",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://data.example.test/parks");
  await expect(
    row.getByText("Preview not available", { exact: true }),
  ).toHaveCount(0);
  await row.getByRole("button", { name: /Show details/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".source-only-badge")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Neighborhood parks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Source-only dataset" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "This browser could not connect to the source",
  );
  await page.getByText("Check details", { exact: true }).click();
  await expect(
    page.getByText("Publisher blocked browser access.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open publisher source" }),
  ).toHaveAttribute("href", "https://data.example.test/parks");
  await expect(page.getByRole("button", { name: /Page CSV/ })).toHaveCount(0);
  expect(api.queries).toHaveLength(0);
  expect(requests).toEqual([`${dataset.serviceUrl}/${dataset.layerId}?f=json`]);
});
