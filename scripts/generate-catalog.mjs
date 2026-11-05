// Consume the R package's own checked JSON registry, not a duplicated dataset list.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { z } from "zod";
const root = resolve(process.env.TBOD_SOURCE || ".upstream");
const commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const registry = JSON.parse(
  await readFile(resolve(root, "inst/extdata/datasets.json"), "utf8"),
);
const schemaInput = JSON.parse(
  await readFile(resolve(root, "inst/extdata/expected-schemas.json"), "utf8"),
);
const schemaEntry = z.object({
  endpoint: z.string().url(),
  geometry_type: z.string(),
  fields: z.array(
    z.object({
      name: z.string().min(1),
      type: z.string(),
      alias: z.string().optional(),
    }),
  ),
});
const schemas = z.record(z.string(), schemaEntry).parse(schemaInput);
if (!Array.isArray(registry) || !registry.length)
  throw Error("Upstream checked registry is empty or changed shape");
const registryKeys = new Set(
  registry.map((entry) => `${entry.jurisdiction}/${entry.id}`),
);
for (const key of Object.keys(schemas)) {
  if (!registryKeys.has(key))
    throw Error(`Expected schema references an unknown dataset: ${key}`);
}
const required = [
  "id",
  "title",
  "description",
  "jurisdiction",
  "publisher",
  "service_url",
  "layer_id",
  "geometry_type",
  "verified",
  "source_url",
  "category",
  "terms",
  "tags",
];
const datasets = registry.map((d) => {
  for (const key of required)
    if (!(key in d)) throw Error(`Upstream interface changed: missing ${key}`);
  const id = `${d.jurisdiction}/${d.id}`;
  const schema = schemas[id];
  if (
    schema &&
    (schema.endpoint !== `${d.service_url}/${d.layer_id}` ||
      schema.geometry_type !== d.geometry_type)
  )
    throw Error(`Schema endpoint/geometry mismatch: ${id}`);
  return {
    id,
    packageId: d.id,
    title: d.title,
    description: d.description || null,
    publisher: d.publisher,
    jurisdiction: d.jurisdiction,
    coverage: null,
    category: d.category || null,
    serviceUrl: d.service_url,
    layerId: d.layer_id,
    geometryType: d.geometry_type,
    fields: schema?.fields ?? null,
    verified: d.verified || null,
    sourceUrl: d.source_url,
    terms: d.terms || null,
    termsUrl: d.terms_url || null,
    scopeNote: d.scope_note || null,
    tags: d.tags,
  };
});
const output = resolve(process.env.TBOD_OUTPUT || "public/catalog.json");
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.pending`;
await writeFile(
  temporary,
  JSON.stringify(
    {
      schemaVersion: 1,
      upstreamCommit: commit,
      generatedAt: new Date().toISOString(),
      datasets,
    },
    null,
    2,
  ) + "\n",
);
execFileSync(
  process.execPath,
  ["--import", "tsx", "scripts/validate-catalog.ts", temporary],
  { stdio: "inherit" },
);
await rename(temporary, output);
console.log(`Generated all ${datasets.length} checked entries from ${commit}`);
