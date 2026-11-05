import { readFileSync } from "node:fs";
const report = JSON.parse(readFileSync("public/discovery.json", "utf8"));
console.log(
  `Discovery metadata generated: ${report.generatedAt}\n\n${report.datasets.length} retained layers. Complete inventory: ${report.complete ? "yes" : "no"}.\n\n| Portal | Items scanned / reported | Layers | Issues |\n| --- | --- | --- | --- |`,
);
for (const run of report.runs)
  console.log(
    `| ${run.portalId} | ${run.itemsScanned} / ${run.totalItems ?? "unknown"} | ${run.datasetsFound} | ${run.issues.length} |`,
  );
