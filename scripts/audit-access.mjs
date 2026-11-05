// Opt-in browser audit; never part of routine CI. At most two publishers requests
// run concurrently, with a single bounded query per successfully inspected layer.
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const origin = new URL(
  process.argv[2] || "https://tbdataexplorer.pages.dev",
).origin;
const output = process.argv[3] || "public/access.json";
const catalog = JSON.parse(await readFile("public/catalog.json", "utf8"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(origin);
  const datasets = [];
  for (let start = 0; start < catalog.datasets.length; start += 2) {
    const results = await page.evaluate(
      async (entries) => {
        async function check(dataset) {
          const endpoint = `${dataset.serviceUrl}/${dataset.layerId}`;
          let stage = "metadata";
          const result = {
            id: dataset.id,
            endpoint,
            status: "source-only",
            stage,
            reason: null,
            recordCount: null,
          };
          async function json(url) {
            const response = await fetch(url, {
              signal: AbortSignal.timeout(15000),
            });
            if (!response.ok)
              throw Error(`Publisher returned HTTP ${response.status}.`);
            const body = await response.json();
            if (body.error)
              throw Error(`ArcGIS ${body.error.code}: ${body.error.message}`);
            return body;
          }
          try {
            const metadata = await json(`${endpoint}?f=json`);
            if (!Array.isArray(metadata.fields))
              throw Error("Publisher returned unsupported metadata.");
            if (
              metadata.capabilities &&
              !metadata.capabilities
                .split(",")
                .some((x) => x.trim().toLowerCase() === "query")
            )
              throw Error("Publisher does not advertise Query capability.");
            stage = "query";
            const oid =
              metadata.objectIdField ||
              metadata.objectIdFieldName ||
              metadata.fields.find((f) => f.type === "esriFieldTypeOID")?.name;
            const params = new URLSearchParams({
              f: "json",
              where: "1=1",
              outFields: oid || "*",
              returnGeometry: String(!!metadata.geometryType),
              outSR: "4326",
              resultRecordCount: "1",
            });
            if (metadata.advancedQueryCapabilities?.supportsPagination)
              params.set("resultOffset", "0");
            if (metadata.advancedQueryCapabilities?.supportsOrderBy && oid)
              params.set("orderByFields", `${oid} ASC`);
            const body = await json(`${endpoint}/query?${params}`);
            if (!Array.isArray(body.features))
              throw Error("Publisher returned unsupported query results.");
            if (body.features.length > 1)
              throw Error("Publisher ignored the one-record preview limit.");
            return {
              ...result,
              status: "available",
              stage: "complete",
              recordCount: body.features.length,
            };
          } catch (error) {
            const reason =
              error instanceof TypeError
                ? "Browser request failed: the publisher may block cross-origin access or be unreachable."
                : error.message;
            return { ...result, stage, reason };
          }
        }
        return Promise.all(entries.map(check));
      },
      catalog.datasets.slice(start, start + 2),
    );
    datasets.push(...results);
    console.log(
      `${datasets.length}/${catalog.datasets.length}: ${results.map((r) => `${r.id} ${r.status}`).join("; ")}`,
    );
  }
  const report = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    catalogCommit: catalog.upstreamCommit,
    origin,
    datasets,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      total: datasets.length,
      available: datasets.filter((d) => d.status === "available").length,
      sourceOnly: datasets.filter((d) => d.status === "source-only").length,
      output,
    }),
  );
} finally {
  await browser.close();
}
