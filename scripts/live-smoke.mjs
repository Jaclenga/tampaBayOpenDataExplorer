// Optional manual production-origin check. Never invoked by routine CI.
import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
const base = process.argv[2] || "https://tampabay-open-data-explorer.pages.dev";
const catalog = JSON.parse(await readFile("public/catalog.json", "utf8"));
const samples = [
  ...new Map(catalog.datasets.map((d) => [d.publisher, d])).values(),
];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("requestfailed", (request) =>
    console.log(
      "Request failed:",
      new URL(request.url()).hostname,
      request.failure()?.errorText,
    ),
  );
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("tampagov"))
      console.log("Browser diagnostic:", message.text());
  });
  await page.goto(base);
  const checks = await page.evaluate(
    async (entries) =>
      Promise.all(
        entries.map(async (d) => {
          try {
            const r = await fetch(`${d.serviceUrl}/${d.layerId}?f=json`, {
              signal: AbortSignal.timeout(15000),
            });
            const m = await r.json();
            return {
              publisher: d.publisher,
              http: r.status,
              fields: m.fields?.length ?? null,
              pagination:
                m.advancedQueryCapabilities?.supportsPagination ?? null,
              error: m.error?.message ?? null,
            };
          } catch (e) {
            return { publisher: d.publisher, error: String(e) };
          }
        }),
      ),
    samples,
  );
  console.log(JSON.stringify(checks, null, 2));
  const previewId = samples.find(
    (d) => d.publisher === "City of St. Petersburg",
  ).id;
  await page.goto(`${base}/#${encodeURIComponent(previewId)}`);
  await page
    .locator(".record-count, .error")
    .first()
    .waitFor({ timeout: 60000 });
  console.log(
    "Live preview:",
    await page.locator(".record-count, .error").first().innerText(),
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/production-live.png",
    fullPage: false,
  });
  if (await page.locator(".error").count()) process.exitCode = 1;
  if (checks.some((c) => c.error || !c.fields)) process.exitCode = 1;
} finally {
  await browser.close();
}
