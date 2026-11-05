import { readFileSync } from "node:fs";
import { validateIndex } from "../src/server/discovery-index";
const content=readFileSync('public/discovery.json','utf8');
if(Buffer.byteLength(content)>4194304)throw Error('Discovery metadata exceeds the 4 MiB serving limit. Reduce scan budgets or field snapshots before publishing.');
const report = validateIndex(JSON.parse(content));
console.log(
  `Validated ${report.datasets.length} discovered datasets; complete scan: ${report.complete}`,
);
