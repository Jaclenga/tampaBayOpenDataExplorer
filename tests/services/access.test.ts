import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAccessReport } from "../../src/services/access";
import { parseCatalog } from "../../src/services/catalog";
import { accessReport, catalog } from "../fixtures";

describe("browser access status", () => {
  it("validates the complete committed report against the committed catalog", () => {
    const actualCatalog = parseCatalog(
      JSON.parse(readFileSync("public/catalog.json", "utf8")),
    );
    const report = parseAccessReport(
      JSON.parse(readFileSync("public/access.json", "utf8")),
      actualCatalog,
    );
    expect(report.datasets).toHaveLength(actualCatalog.datasets.length);
  });
  it("keeps source-only entries with an explicit reason", () => {
    const value = structuredClone(accessReport);
    value.datasets[0] = {
      ...value.datasets[0],
      status: "source-only",
      stage: "metadata",
      recordCount: null,
      reason: "Browser access blocked.",
    };
    expect(parseAccessReport(value, catalog).datasets[0].status).toBe(
      "source-only",
    );
  });
  it.each([
    [
      "missing dataset",
      { ...accessReport, datasets: accessReport.datasets.slice(1) },
    ],
    [
      "duplicate dataset",
      {
        ...accessReport,
        datasets: [
          accessReport.datasets[0],
          accessReport.datasets[0],
          accessReport.datasets[1],
        ],
      },
    ],
    ["wrong revision", { ...accessReport, catalogCommit: "wrong" }],
    [
      "wrong endpoint",
      {
        ...accessReport,
        datasets: accessReport.datasets.map((d) => ({
          ...d,
          endpoint: "https://incorrect.example.test/0",
        })),
      },
    ],
    [
      "source-only without reason",
      {
        ...accessReport,
        datasets: accessReport.datasets.map((d) => ({
          ...d,
          status: "source-only",
        })),
      },
    ],
    [
      "unverified available entry",
      {
        ...accessReport,
        datasets: accessReport.datasets.map((d) => ({
          ...d,
          recordCount: null,
        })),
      },
    ],
  ])("rejects %s", (_name, value) =>
    expect(() => parseAccessReport(value, catalog)).toThrow(),
  );
});
