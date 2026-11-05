import { readFileSync } from "node:fs";
import { parseCatalog } from "../src/services/catalog";
const catalog = parseCatalog(
  JSON.parse(readFileSync(process.argv[2] || "public/catalog.json", "utf8")),
);
console.log(
  `Validated ${catalog.datasets.length} datasets from ${catalog.upstreamCommit}`,
);
