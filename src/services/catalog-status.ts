import policy from "../../config/catalog-status.json";
import type { DiscoveryReport, PortalRun } from "./discovery/types";
import portals from "../../config/portals.json";
export const staleAfterHours = policy.staleAfterHours;
export function catalogStatus(
  report: DiscoveryReport,
  warning: string | null = null,
  now = Date.now(),
) {
  const verified = report.refresh?.verified ?? null;
  const successfulAt =
    report.lastSuccessfulRunAt ??
    (verified && verified > 0 ? report.refresh!.finishedAt : null);
  const attemptedAt =
    report.refresh?.startedAt ??
    report.runs
      .map((r) => r.startedAt)
      .sort()
      .at(-1) ??
    null;
  const issues = report.runs.reduce((n, r) => n + r.issues.length, 0);
  const state = statusState(report, successfulAt, verified, warning, now);
  return {
    state,
    successfulAt,
    attemptedAt,
    verified,
    issues,
    publishers: new Set(report.runs.map((r) => publisherName(r.portalId))).size,
  };
}
function statusState(
  report: DiscoveryReport,
  successfulAt: string | null,
  verified: number | null,
  warning: string | null,
  now: number,
) {
  const retained = [...report.datasets, ...(report.curatedUpdates ?? [])];
  const usable =
    verified !== null &&
    (verified > 0 || retained.some((d) => d.lastVerifiedAt));
  if (!successfulAt || !usable) return "Unavailable";
  if (now - Date.parse(successfulAt) > staleAfterHours * 3600000)
    return "Stale";
  return hasLimitations(report, warning) ? "Partial" : "Healthy";
}
function hasLimitations(report: DiscoveryReport, warning: string | null) {
  return (
    !!warning ||
    !report.complete ||
    !report.runs.length ||
    report.refresh?.outcome !== "success" ||
    (report.refresh?.curatedErrors ?? 0) > 0 ||
    report.runs.some((r) => r.issues.length > 0) ||
    report.datasets.some((d) => d.verificationError)
  );
}
export function coverageLabel(report: DiscoveryReport) {
  if (!report.runs.length) return "Discovery coverage unavailable";
  return report.complete
    ? "Configured sources fully scanned"
    : "Some sources were only partially scanned";
}
export function publisherName(portalId: string) {
  return portals.find((p) => p.id === portalId)?.publisher ?? portalId;
}
export function publisherLastCheck(report: DiscoveryReport, portalId: string) {
  return (
    report.datasets
      .filter((d) => d.portalId === portalId && d.lastVerifiedAt)
      .map((d) => d.lastVerifiedAt!)
      .sort()
      .at(-1) ?? null
  );
}
const explanations = {
  request: "Source request failed",
  unsupported: "Source format not supported",
  truncated: "Scan limit reached",
  security: "Source configuration needs review",
  schema: "Source metadata needs review",
};
export function groupedIssues(run: PortalRun) {
  const groups = new Map<
    string,
    { label: string; message: string; count: number; endpoints: string[] }
  >();
  for (const issue of run.issues) {
    const key = JSON.stringify([issue.kind, issue.message]);
    const group = groups.get(key) ?? {
      label: explanations[issue.kind],
      message: issue.message,
      count: 0,
      endpoints: [],
    };
    group.count++;
    if (issue.endpoint && !group.endpoints.includes(issue.endpoint))
      group.endpoints.push(issue.endpoint);
    groups.set(key, group);
  }
  return [...groups.values()];
}
export function displayStatusDate(value: string | null, short = false) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString(
    undefined,
    short ? { month: "short", day: "numeric", year: "numeric" } : undefined,
  );
}
