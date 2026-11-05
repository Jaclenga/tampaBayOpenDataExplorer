// Optional real production check. Routine CI uses mocked browser tests.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
import { canonicalEndpoint } from "../src/services/source-url.ts";
const base = process.argv[2] || "https://tbdataexplorer.pages.dev";
const catalog = JSON.parse(await readFile("public/catalog.json", "utf8"));
const expected = JSON.parse(await readFile("public/access.json", "utf8"));
const policy = JSON.parse(await readFile("config/proxy.json", "utf8"));
const discoveryResponse = await fetch(base + "/api/discovery");
assert.ok(discoveryResponse.ok, "Live discovery index must be available");
const discovery = await discoveryResponse.json();
const endpoints = new Set(
  [...catalog.datasets, ...discovery.datasets].map(
    (dataset) =>
      dataset.resource?.url ??
      canonicalEndpoint(`${dataset.serviceUrl}/${dataset.layerId}`),
  ),
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ acceptDownloads: true });
  const publisherRequests = [];
  page.on("request", (request) => {
    if (/\/(FeatureServer|MapServer)\//.test(request.url()))
      publisherRequests.push(request.url());
  });
  await page.goto(base);
  await page.locator(".dataset-card").first().waitFor();
  assert.equal(
    await page.locator(".dataset-card").count(),
    Math.min(100, endpoints.size),
  );
  const sourceOnly = expected.datasets.filter(
    (d) =>
      d.status === "source-only" &&
      !policy.servicePrefixes.some((prefix) => d.endpoint.startsWith(prefix)),
  );
  assert.equal(
    await page.locator(".source-only-badge").count(),
    sourceOnly.length,
  );
  const remote = await page.evaluate(async () => {
    const response = await fetch("/access.json");
    if (!response.ok) throw Error("Published access report is unavailable");
    return response.json();
  });
  assert.deepEqual(
    remote,
    expected,
    "Published audit must match the reviewed report",
  );
  if (sourceOnly.length) {
    await page.goto(base + "/#" + encodeURIComponent(sourceOnly[0].id));
    await page.getByRole("heading", { name: "Source-only dataset" }).waitFor();
    assert.equal(
      await page.getByRole("link", { name: "Open publisher source" }).count(),
      1,
    );
    assert.equal(
      publisherRequests.length,
      0,
      "Source-only pages must not issue publisher requests",
    );
  }
  const available = expected.datasets.find(
    (d) => d.status === "available" && d.id.startsWith("stpete/"),
  );
  assert.ok(available, "A live preview candidate is required");
  await page.goto(base + "/#" + encodeURIComponent(available.id));
  await page
    .locator(".record-count, .error")
    .first()
    .waitFor({ timeout: 60000 });
  assert.equal(await page.locator(".error").count(), 0, "Live preview failed");
  const loaded = await page.locator(".record-count").innerText();
  const count = Number(loaded.match(/^\d+/)[0]);
  assert.ok(
    count > 0 && count <= 100,
    "Preview must load between 1 and 100 records",
  );
  await page.getByText(/Map ready/).waitFor({ timeout: 30000 });
  assert.ok(
    await page.getByRole("button", { name: /Page GeoJSON/ }).isEnabled(),
  );
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Page CSV/ }).click();
  assert.ok((await downloaded).suggestedFilename().endsWith(".csv"));
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/production-live.png",
    fullPage: false,
  });
  const tampa = expected.datasets.find((d) => d.id.startsWith("tampa/"));
  assert.ok(tampa, "Tampa proxy candidate required");
  const proxyMetadata = await fetch(
    base +
      "/api/arcgis?" +
      new URLSearchParams({ dataset: tampa.id, operation: "metadata" }),
  );
  assert.ok(proxyMetadata.ok, "Allowlisted Tampa metadata must be reachable");
  assert.ok(
    (await proxyMetadata.json()).fields?.length,
    "Proxy metadata schema missing",
  );
  const proxyRecords = await fetch(
    base +
      "/api/arcgis?" +
      new URLSearchParams({
        dataset: tampa.id,
        operation: "query",
        where: "1=1",
        outFields: "*",
        returnGeometry: "false",
        resultRecordCount: "1",
        resultOffset: "0",
      }),
  );
  assert.ok(proxyRecords.ok, "Allowlisted Tampa records must be reachable");
  const tampaRows = await proxyRecords.json();
  assert.ok(
    Array.isArray(tampaRows.features) && tampaRows.features.length <= 1,
    "Proxy must return a bounded live page",
  );
  assert.equal(
    (
      await fetch(
        base + "/api/arcgis?dataset=https://127.0.0.1&operation=query",
      )
    ).status,
    404,
    "Unregistered proxy targets must fail",
  );
  console.log(
    JSON.stringify({
      origin: new URL(base).origin,
      datasets: endpoints.size,
      discovered: discovery.datasets.length,
      sourceOnly: sourceOnly.length,
      available: expected.datasets.length - sourceOnly.length,
      liveDataset: available.id,
      loadedRecords: count,
      map: true,
      csv: true,
      geojson: true,
      tampaProxy: true,
    }),
  );
} finally {
  await browser.close();
}
