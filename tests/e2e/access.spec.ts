import { test, expect } from "@playwright/test";
import { accessReport } from "../fixtures";
import { installApi } from "./helpers";

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
  await expect(
    page.getByText("Source only · browser preview unavailable"),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Neighborhood parks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Source-only dataset" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Publisher blocked browser access.",
  );
  await expect(
    page.getByRole("link", { name: "Open publisher source" }),
  ).toHaveAttribute("href", "https://data.example.test/parks");
  await expect(page.getByRole("button", { name: /Page CSV/ })).toHaveCount(0);
  expect(api.queries).toHaveLength(0);
  expect(requests).toEqual([]);
});
