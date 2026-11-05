import { readFile } from "node:fs/promises";
import { test, expect, type Download } from "@playwright/test";
import { record } from "../fixtures";
import { detailUrl, installApi } from "./helpers";

async function contents(download: Download) {
  const path = await download.path();
  if (!path) throw new Error("The browser did not save the download");
  return readFile(path, "utf8");
}

test("retry keeps rejecting repeated pages until a valid replacement arrives", async ({
  page,
}) => {
  let corrected = false;
  const api = await installApi(page, {
    query: (url) => {
      const later = url.searchParams.get("resultOffset") !== "0";
      const features =
        later && corrected ? [record(3)] : [record(1), record(2)];
      return { body: { features, exceededTransferLimit: !later } };
    },
  });
  await page.goto("/#county%2Fbudget");
  await expect(
    page.getByRole("cell", { name: "Park 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByRole("alert")).toContainText("repeated record IDs");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => api.queries.length).toBe(3);
  await expect(page.getByRole("alert")).toContainText("repeated record IDs");
  await expect(
    page.getByRole("cell", { name: "Park 1", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Page CSV/ })).toBeDisabled();
  corrected = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("cell", { name: "Park 3", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Previous/ }).click();
  await expect(
    page.getByRole("cell", { name: "Park 1", exact: true }),
  ).toBeVisible();
});

test("invalid spatial data retains table preview and CSV while disabling spatial export", async ({
  page,
}) => {
  await installApi(page, {
    query: () => ({
      body: {
        features: [
          {
            attributes: { OBJECTID: 1, NAME: "Projected park" },
            geometry: { x: 10, y: 10, spatialReference: { wkid: 3857 } },
          },
        ],
        exceededTransferLimit: false,
      },
    }),
  });
  await page.goto(detailUrl);
  await expect(
    page.getByRole("cell", { name: "Projected park", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("WGS84");
  await expect(
    page.getByRole("button", { name: /Page GeoJSON/ }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /Page CSV/ })).toBeEnabled();
  await expect(
    page.getByRole("region", { name: "Map of loaded spatial records" }),
  ).toHaveCount(0);
});

test("nonspatial preview sorts numerically, paginates, and exports only the loaded page", async ({
  page,
}) => {
  const api = await installApi(page);
  await page.goto("/#county%2Fbudget");
  await expect(
    page.getByRole("cell", { name: "Oak Park", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Map of loaded spatial records" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Page GeoJSON/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Value", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Oak Park");
  await page.getByRole("button", { name: "Value", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Bay Park");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(
    page.getByRole("cell", { name: "Cedar Park", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
  expect(api.queries.at(-1)?.searchParams.get("resultOffset")).toBe("2");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Page CSV/ }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("budget-page-2.csv");
  const text = await contents(download);
  expect(text).toContain("Cedar Park");
  expect(text).not.toContain("Oak Park");
  await page.getByRole("button", { name: /Previous/ }).click();
  await expect(
    page.getByRole("cell", { name: "Oak Park", exact: true }),
  ).toBeVisible();
});

test("short transfer-limited pages never skip records when navigating forward and back", async ({
  page,
}) => {
  const api = await installApi(page, {
    query: (url) => {
      const offset = Number(url.searchParams.get("resultOffset") ?? 0);
      return {
        body: {
          features: [record(offset + 1)],
          spatialReference: { wkid: 4326 },
          exceededTransferLimit: offset < 2,
        },
      };
    },
  });
  await page.goto("/#county%2Fbudget");
  await expect(
    page.getByRole("cell", { name: "Park 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(
    page.getByRole("cell", { name: "Park 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(
    page.getByRole("cell", { name: "Park 3", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Previous/ }).click();
  await expect(
    page.getByRole("cell", { name: "Park 2", exact: true }),
  ).toBeVisible();
  expect(api.queries.map((q) => q.searchParams.get("resultOffset"))).toEqual([
    "0",
    "1",
    "2",
    "1",
  ]);
});

test("a failed next page leaves a usable previous-page control", async ({
  page,
}) => {
  await installApi(page, {
    query: (url) => ({
      body:
        url.searchParams.get("resultOffset") === "0"
          ? { features: [record(1), record(2)], exceededTransferLimit: true }
          : { error: { code: 400, message: "Page unavailable" } },
    }),
  });
  await page.goto("/#county%2Fbudget");
  await expect(
    page.getByRole("cell", { name: "Park 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page.getByRole("alert")).toContainText("Page unavailable");
  await expect(page.getByRole("button", { name: /Page CSV/ })).toBeDisabled();
  await page.getByRole("button", { name: /Previous/ }).click();
  await expect(
    page.getByRole("cell", { name: "Park 1", exact: true }),
  ).toBeVisible();
});

test("an unsupported query explains the failure without fetching records", async ({
  page,
}) => {
  const api = await installApi(page, { metadata: { capabilities: "Extract" } });
  await page.goto(detailUrl);
  await expect(page.getByRole("alert")).toContainText("Query capability");
  expect(api.queries).toHaveLength(0);
});

test("unsupported pagination permits an initial preview with no misleading Next button", async ({
  page,
}) => {
  await installApi(page, {
    metadata: {
      advancedQueryCapabilities: {
        supportsPagination: false,
        supportsOrderBy: false,
      },
    },
  });
  await page.goto("/#county%2Fbudget");
  await expect(page.getByRole("status")).toContainText(
    "initial bounded preview",
  );
  await expect(
    page.getByRole("cell", { name: "Oak Park", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Next/ })).toBeDisabled();
});

test("map-area queries reset pagination and export their returned geometry", async ({
  page,
}) => {
  const api = await installApi(page);
  await page.goto(detailUrl);
  await expect(
    page.getByRole("button", { name: "Search this map area" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Search this map area" }).click();
  await expect(
    page.getByRole("cell", { name: "Filtered park", exact: true }),
  ).toBeVisible();
  const query = api.queries.at(-1)!;
  expect(query.searchParams.get("resultOffset")).toBe("0");
  expect(query.searchParams.get("geometryType")).toBe("esriGeometryEnvelope");
  expect(
    JSON.parse(query.searchParams.get("geometry")!).spatialReference.wkid,
  ).toBe(4326);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Page GeoJSON/ }).click();
  const output = JSON.parse(await contents(await downloaded));
  expect(output.features).toHaveLength(1);
  expect(output.features[0].properties.NAME).toBe("Filtered park");
  await page.getByRole("button", { name: "Clear area filter" }).click();
  await expect(
    page.getByRole("cell", { name: "Oak Park", exact: true }),
  ).toBeVisible();
  expect(api.queries.at(-1)?.searchParams.has("geometry")).toBe(false);
});

test("a rejected map-area query can be cleared without leaving the dataset", async ({
  page,
}) => {
  await installApi(page, {
    query: (url) => ({
      body: url.searchParams.has("geometry")
        ? { error: { code: 400, message: "Spatial query unsupported" } }
        : {
            features: [record(1)],
            spatialReference: { wkid: 4326 },
            exceededTransferLimit: false,
          },
    }),
  });
  await page.goto(detailUrl);
  await expect(
    page.getByRole("button", { name: "Search this map area" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Search this map area" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Spatial query unsupported",
  );
  await page.getByRole("button", { name: "Clear area filter" }).click();
  await expect(
    page.getByRole("cell", { name: "Park 1", exact: true }),
  ).toBeVisible();
});

test("empty datasets retain a CSV header and disable further navigation", async ({
  page,
}) => {
  await installApi(page, {
    query: () => ({ body: { features: [], exceededTransferLimit: false } }),
  });
  await page.goto("/#county%2Fbudget");
  await expect(
    page.getByText("No records found in this preview."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Next/ })).toBeDisabled();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Page CSV/ }).click();
  expect(await contents(await downloaded)).toContain(
    '"OBJECTID","NAME","VALUE"',
  );
});
