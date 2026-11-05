// Verify the existing secretless Pages runtime-index delivery path after a push.
import { readFile } from "node:fs/promises";
const expected = JSON.parse(await readFile("public/discovery.json", "utf8"));
const categories = (report) =>
  JSON.stringify(
    [...(report.curatedUpdates ?? []), ...report.datasets]
      .map((d) => [d.id, d.category, d.category_source, d.category_version])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
const origin =
  process.env.CATALOG_SITE_URL || "https://tbdataexplorer.pages.dev";
const deadline = Date.now() + 12 * 60 * 1000;
for (let attempt = 1; attempt <= 25 && Date.now() < deadline; attempt++) {
  try {
    const response = await fetch(
      `${origin}/api/discovery?publication=${encodeURIComponent(expected.generatedAt)}`,
      {
        signal: AbortSignal.timeout(
          Math.max(1, Math.min(15000, deadline - Date.now())),
        ),
        cache: "no-store",
      },
    );
    if (!response.ok) throw Error(`Index HTTP ${response.status}`);
    const actual = await response.json();
    if (
      response.headers.get("X-Catalog-Index") !== "scheduled-index" ||
      actual.generatedAt !== expected.generatedAt ||
      actual.datasets.length !== expected.datasets.length ||
      categories(actual) !== categories(expected)
    )
      throw Error("Pages is still serving a cached or fallback index.");
    console.log(
      `Published catalog verified: ${origin}, ${actual.generatedAt}, ${actual.datasets.length} public layers.`,
    );
    process.exit(0);
  } catch (error) {
    console.log(`Publication check ${attempt}/25: ${error.message}`);
    if (attempt >= 25 || Date.now() + 30000 >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}
throw Error(
  "The committed catalog was not visible after the cache propagation window. Inspect /api/discovery and its X-Catalog-Index header.",
);
