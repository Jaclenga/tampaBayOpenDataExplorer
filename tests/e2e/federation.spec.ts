import { test, expect } from "@playwright/test";
import { installApi } from "./helpers";
import { dataset, layerResponse, record } from "../fixtures";
import { emptyDiscovery } from "../discovery-fixture";

test("new discoveries join the catalog, retain provenance, and query filtered live pages", async ({
  page,
}) => {
  const { queries } = await installApi(page);
  const discovered = {
    ...dataset,
    id: "arcgis:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:90",
    layerId: 90,
    title: "Newly published parks",
    scopeNote:
      "Automatically discovered public portal layer. Not reviewed by the curated R-package catalog.",
    validationStatus: "discovered",
    platform: "arcgis",
    lastVerifiedAt: "2026-11-04T12:00:00.000Z",
    sourceUpdatedAt: "2024-01-01T00:00:00.000Z",
    sourceUpdatedKind: "records",
  };
  await page.route("**/api/discovery", (route) =>
    route.fulfill({ json: { ...emptyDiscovery, datasets: [discovered] } }),
  );
  await page.goto("/");
  await expect(page.locator(".dataset-card")).toHaveCount(4);
  expect(queries).toHaveLength(0);
  const row = page.locator(".dataset-card").filter({
    has: page.getByRole("heading", {
      name: "Newly published parks",
      exact: true,
    }),
  });
  await row.getByRole("button", { name: /Show details/ }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Last verified endpoint", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Automatically discovered public portal layer. Not reviewed by the curated R-package catalog.",
      { exact: true },
    ),
  ).toHaveCount(0);

  await expect(
    page.getByRole("combobox", { name: "Catalog group" }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Explore dataset", exact: true })
    .click();
  await expect(
    page.getByText("Automatically discovered · not curator-reviewed"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: "Oak Park", exact: true }),
  ).toBeVisible();
  await page.getByText("Filter source records", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Record field" })
    .selectOption("NAME");
  await page.getByRole("textbox", { name: "Filter value" }).fill("O'Brien");
  await page.getByRole("button", { name: "Apply record filter" }).click();
  await expect
    .poll(() => queries.at(-1)?.searchParams.get("where"))
    .toBe("NAME = 'O''Brien'");
  expect(queries.at(-1)?.searchParams.get("resultOffset")).toBe("0");
  await expect(page.getByText(/Publisher source updated:/)).toContainText(
    /2023|2024/,
  );
  await expect(page.getByText(/Last successful endpoint check:/)).toContainText(
    "2026",
  );
});

test("curated catalog remains accessible when the discovery index is unavailable", async ({
  page,
}) => {
  await installApi(page);
  await page.route("**/api/discovery", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.route("**/discovery.json", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/");
  await expect(page.locator(".dataset-card")).toHaveCount(3);
  await expect(page.locator(".discovery-status")).toContainText(
    "Verification status unavailable",
  );
  await page
    .getByRole("link", { name: "Coverage details", exact: true })
    .click();
  await expect(
    page.getByText(
      "Discovery is temporarily unavailable. The curated catalog remains available.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("a registered Tampa layer uses the narrow proxy after direct browser access fails", async ({
  page,
}) => {
  await installApi(page);
  const d = {
    ...dataset,
    id: "arcgis:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:0",
    title: "Tampa live parks",
    serviceUrl:
      "https://arcgis.tampagov.net/arcgis/rest/services/Test/FeatureServer",
    validationStatus: "discovered",
    platform: "arcgis",
  };
  await page.route("**/api/discovery", (route) =>
    route.fulfill({ json: { ...emptyDiscovery, datasets: [d] } }),
  );
  await page.route("https://arcgis.tampagov.net/**", (route) =>
    route.abort("failed"),
  );
  const requests: URL[] = [];
  await page.route("**/api/arcgis?*", (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    return route.fulfill({
      json:
        url.searchParams.get("operation") === "metadata"
          ? layerResponse
          : {
              features: [record(1, "Proxy park")],
              spatialReference: { wkid: 4326 },
              exceededTransferLimit: false,
            },
    });
  });
  await page.goto("/#" + encodeURIComponent(d.id));
  await expect(
    page.getByRole("cell", { name: "Proxy park", exact: true }),
  ).toBeVisible();
  expect(requests.map((url) => url.searchParams.get("operation"))).toEqual([
    "metadata",
    "query",
  ]);
  expect(
    requests.every(
      (url) =>
        url.searchParams.get("dataset") === d.id &&
        !url.searchParams.has("url"),
    ),
  ).toBe(true);
});
