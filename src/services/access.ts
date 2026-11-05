import { z } from "zod";
import type { Catalog } from "../types";

const accessSchema = z
  .object({
    id: z.string(),
    endpoint: z.url(),
    status: z.enum(["available", "source-only"]),
    stage: z.enum(["metadata", "query", "complete"]),
    reason: z.string().nullable(),
    recordCount: z.number().int().min(0).max(1).nullable(),
  })
  .superRefine((entry, context) => {
    if (entry.status === "source-only" && !entry.reason)
      context.addIssue({
        code: "custom",
        message: "Source-only entries require a reason",
      });
    if (
      entry.status === "available" &&
      (entry.stage !== "complete" ||
        entry.recordCount === null ||
        entry.reason !== null)
    )
      context.addIssue({
        code: "custom",
        message: "Available entries require a successful query check",
      });
  });
const reportSchema = z.object({
  schemaVersion: z.literal(1),
  checkedAt: z.iso.datetime(),
  catalogCommit: z.string(),
  origin: z.url(),
  datasets: z.array(accessSchema),
});
export type DatasetAccess = z.infer<typeof accessSchema>;
export type AccessReport = z.infer<typeof reportSchema>;

export function parseAccessReport(
  value: unknown,
  catalog: Catalog,
): AccessReport {
  const report = reportSchema.parse(value);
  if (report.catalogCommit !== catalog.upstreamCommit)
    throw Error("Browser access report does not match the catalog revision.");
  const entries = new Map(report.datasets.map((entry) => [entry.id, entry]));
  if (
    entries.size !== report.datasets.length ||
    entries.size !== catalog.datasets.length
  )
    throw Error("Browser access report must cover every dataset exactly once.");
  for (const dataset of catalog.datasets) {
    if (
      entries.get(dataset.id)?.endpoint !==
      `${dataset.serviceUrl}/${dataset.layerId}`
    )
      throw Error(`Browser access report endpoint mismatch: ${dataset.id}`);
  }
  return report;
}
