import { readFileSync } from "node:fs";
import { parseCatalog } from "../src/services/catalog";
import { parseAccessReport } from "../src/services/access";

const catalog = parseCatalog(
  JSON.parse(readFileSync("public/catalog.json", "utf8")),
);
const report = parseAccessReport(
  JSON.parse(readFileSync("public/access.json", "utf8")),
  catalog,
);
console.log(
  `Validated browser access status for all ${report.datasets.length} datasets (${report.origin})`,
);
