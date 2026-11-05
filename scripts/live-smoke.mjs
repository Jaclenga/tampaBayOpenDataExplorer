// Optional real production check. Routine CI uses mocked browser tests.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
const base = process.argv[2] || "https://tampabay-open-data-explorer.pages.dev";
const catalog = JSON.parse(await readFile("public/catalog.json", "utf8"));
const expected = JSON.parse(await readFile("public/access.json", "utf8"));
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
    catalog.datasets.length,
  );
  const sourceOnly = expected.datasets.filter(
    (d) => d.status === "source-only",
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
  console.log(
    JSON.stringify({
      origin: new URL(base).origin,
      datasets: catalog.datasets.length,
      sourceOnly: sourceOnly.length,
      available: expected.datasets.length - sourceOnly.length,
      liveDataset: available.id,
      loadedRecords: count,
      map: true,
      csv: true,
      geojson: true,
    }),
  );
} finally {
  await browser.close();
}
