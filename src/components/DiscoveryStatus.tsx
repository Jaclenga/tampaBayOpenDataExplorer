import type { DiscoveryReport } from "../services/discovery/types";

export default function DiscoveryStatus({
  report,
}: {
  report: DiscoveryReport;
}) {
  const issueCount = report.runs.reduce(
    (sum, run) => sum + run.issues.length,
    0,
  );
  return (
    <details className="discovery-status">
      <summary>
        Catalog checked{" "}
        <time dateTime={report.generatedAt}>
          {new Date(report.generatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
        {" / "}
        {report.refresh?.outcome === "failed"
          ? "publishers unavailable"
          : report.complete
            ? "configured portals scanned"
            : "discovery incomplete"}
      </summary>
      <p>
        Published check: {new Date(report.generatedAt).toLocaleString()}.
        {report.refresh &&
          ` ${report.refresh.verified} datasets successfully verified in this attempt; ${report.refresh.curatedErrors} curated endpoint checks failed.`}
        Discovered layers are not curator-reviewed. A service check does not
        establish record accuracy or freshness.
      </p>
      <p>
        {issueCount} scan issues or limits recorded. Prior descriptors are
        retained when a source fails or a scan reaches its budget.
      </p>
      <p>
        Last refresh with successful verifications:{" "}
        {report.lastSuccessfulRunAt
          ? new Date(report.lastSuccessfulRunAt).toLocaleString()
          : "Not yet recorded"}
        . This is not a publisher update time or a complete regional inventory.
      </p>
      <ul>
        {report.runs.map((run) => (
          <li key={run.portalId}>
            {run.portalId}: {run.itemsScanned} services scanned,{" "}
            {run.datasetsFound} datasets found{run.complete ? "" : "; partial"}.{" "}
            {run.issues
              .slice(0, 3)
              .map((issue) => issue.message)
              .join(" ")}
          </li>
        ))}
      </ul>
      <a href="/api/discovery">Latest scheduled discovery report</a>
      {" · "}
      <a href="/discovery.json">Bundled fallback report</a>
    </details>
  );
}
