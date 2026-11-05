import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { z } from "zod";
import { parseCatalog } from "../src/services/catalog";
import { discoverPortal } from "../src/services/discovery";
import {
  discoverySchema,
  portalSchema,
  type PortalRun,
} from "../src/services/discovery/types";
import { preservePrevious } from "../src/services/discovery/identity";
import { getMetadata } from "../src/services/arcgis";
import type { Dataset } from "../src/types";

function option(name: string, fallback: number) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? fallback : Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 1) throw Error(`Invalid ${name}`);
  return value;
}
const maxItems = option("--max-items", 25);
const maxLayers = option("--max-layers", 100);
const output = resolve(process.env.DISCOVERY_OUTPUT ?? "public/discovery.json");
const portals = z
  .array(portalSchema)
  .parse(JSON.parse(await readFile("config/portals.json", "utf8")));
const curated = parseCatalog(
  JSON.parse(await readFile("public/catalog.json", "utf8")),
);
const previous = discoverySchema.parse(
  JSON.parse(await readFile("public/discovery.json", "utf8")),
);
const datasets: Dataset[] = [];
const runs: PortalRun[] = [];
const startedAt = new Date().toISOString();
const signal = AbortSignal.timeout(option("--timeout-ms", 600000));

async function scanPortal(portal: (typeof portals)[number]) {
  console.log(
    `Scanning ${portal.publisher}: at most ${maxItems} services / ${maxLayers} layers`,
  );
  const result = await discoverPortal(portal, { maxItems, maxLayers, signal });
  datasets.push(...result.datasets);
  runs.push(result.run);
  console.log(JSON.stringify(result.run));
}

// Two portals at a time; each portal inspects its own layers sequentially.
for (let index = 0; index < portals.length; index += 2) {
  const batch = portals.slice(index, index + 2);
  const results = await Promise.allSettled(batch.map(scanPortal));
  results.forEach((result, index) => {
    if (result.status === "rejected")
      runs.push({
        portalId: batch[index].id,
        startedAt,
        finishedAt: new Date().toISOString(),
        complete: false,
        itemsScanned: 0,
        layersInspected: 0,
        datasetsFound: 0,
        totalItems: null,
        nextStart: null,
        issues: [
          {
            portalId: batch[index].id,
            kind: "request",
            message: String(result.reason),
          },
        ],
      });
  });
}

const curatedUpdates: Dataset[] = [];
const previousCurated = new Map(
  (previous.curatedUpdates ?? []).map((dataset) => [dataset.id, dataset]),
);
for (let index = 0; index < curated.datasets.length; index += 2) {
  await Promise.all(
    curated.datasets.slice(index, index + 2).map(async (dataset) => {
      const old = previousCurated.get(dataset.id) ?? dataset;
      try {
        const metadata = await getMetadata(dataset, signal);
        curatedUpdates.push({
          ...dataset,
          fields: metadata.fields,
          validationStatus: "curated",
          lastAttemptedAt: new Date().toISOString(),
          lastVerifiedAt: metadata.inspectedAt,
          sourceUpdatedAt: metadata.sourceUpdatedAt,
          sourceUpdatedKind: metadata.sourceUpdatedKind,
          queryable: metadata.query,
          verificationError: null,
        });
      } catch (error) {
        curatedUpdates.push({
          ...old,
          lastAttemptedAt: new Date().toISOString(),
          verificationError:
            error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}
const failures = runs.some((run) => run.totalItems === null);
const merged = preservePrevious(previous.datasets, datasets);
const report = discoverySchema.parse({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  lastSuccessfulRunAt: failures
    ? previous.lastSuccessfulRunAt
    : new Date().toISOString(),
  complete: runs.every((run) => run.complete),
  datasets: merged,
  curatedUpdates,
  runs,
});
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.pending`, JSON.stringify(report, null, 2) + "\n");
await rename(`${output}.pending`, output);
console.log(
  JSON.stringify({
    found: datasets.length,
    retained: merged.length,
    complete: report.complete,
    failed: failures,
    output,
  }),
);
if (failures) process.exitCode = 1;
