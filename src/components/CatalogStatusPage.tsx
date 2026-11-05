import { useEffect, useRef } from "react";
import type { DiscoveryReport, PortalRun } from "../services/discovery/types";
import {
  catalogStatus,
  coverageLabel,
  displayStatusDate,
  groupedIssues,
  publisherLastCheck,
  publisherName,
  staleAfterHours,
} from "../services/catalog-status";
export default function CatalogStatusPage({
  report,
  warning,
}: {
  report: DiscoveryReport;
  warning: string | null;
}) {
  const status = catalogStatus(report, warning);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <main id="main" className="shell catalog-status-page">
      <a href="#catalog">Return to datasets</a>
      <h1 ref={heading} tabIndex={-1}>
        Catalog status
      </h1>
      <section aria-labelledby="status-overview">
        <h2 id="status-overview">Catalog overview</h2>
        <dl className="catalog-metadata">
          <div>
            <dt>Status</dt>
            <dd>{status.state}</dd>
          </div>
          <div>
            <dt>Last successful verification</dt>
            <dd>{displayStatusDate(status.successfulAt)}</dd>
          </div>
          <div>
            <dt>Last attempted refresh</dt>
            <dd>{displayStatusDate(status.attemptedAt)}</dd>
          </div>
          <div>
            <dt>Datasets verified</dt>
            <dd>
              {status.verified === null
                ? "Not recorded"
                : `${status.verified} in the latest recorded attempt`}
            </dd>
          </div>
          <div>
            <dt>Publishers checked</dt>
            <dd>{status.publishers}</dd>
          </div>
          <div>
            <dt>Discovery issues or limits</dt>
            <dd>{status.issues}</dd>
          </div>
          <div>
            <dt>Discovery coverage</dt>
            <dd>{coverageLabel(report)}</dd>
          </div>
        </dl>
        {report.refresh && (
          <p>
            Latest recorded attempt:{" "}
            {report.refresh.outcome === "failed"
              ? "Failed"
              : report.refresh.outcome === "partial"
                ? "Partial"
                : "Successful"}
            . {report.refresh.curatedErrors} curated endpoint checks failed.
          </p>
        )}
        {warning && <p>{warning}</p>}
        <p>
          Verification is considered stale after {staleAfterHours} hours. This
          view describes the published catalog; same-day attempts without
          changes are recorded in the scheduled run history.
        </p>
      </section>
      <section aria-labelledby="status-coverage">
        <h2 id="status-coverage">Discovery coverage</h2>
        <p>
          {!report.runs.length && !report.datasets.length
            ? "Discovery coverage is unavailable. The curated catalog remains accessible."
            : report.complete && report.runs.length > 0
              ? "This catalog includes datasets discovered from participating government sources. All configured sources were scanned, but this is not an exhaustive inventory of Tampa Bay public data."
              : "This catalog includes datasets discovered from participating government sources. Some scans may be incomplete, so it should not be treated as an exhaustive inventory of Tampa Bay public data."}
        </p>
        <p>
          Successful endpoint verification means a source responded to a
          structural check. It does not guarantee that its records are accurate,
          current or complete. Discovery completeness describes how much of the
          configured source list was scanned.
        </p>
        <p>
          Publisher update timestamps describe source updates and appear
          separately on dataset pages. They are not verification dates.
        </p>
      </section>
      <section aria-labelledby="publisher-scans">
        <h2 id="publisher-scans">Publisher scan details</h2>
        {report.runs.length ? (
          report.runs.map((run) => (
            <PublisherScan key={run.portalId} run={run} report={report} />
          ))
        ) : (
          <p>No publisher scan results recorded.</p>
        )}
      </section>
      <section aria-labelledby="technical-reports">
        <h2 id="technical-reports">Technical reports</h2>
        <ul>
          <li>
            <a href="/api/discovery">Latest scheduled discovery report</a>{" "}
            (publisher diagnostics and verification results)
          </li>
          <li>
            <a href="/discovery.json">Discovery report</a> (bundled snapshot)
          </li>
          <li>
            <a href="/access.json">Browser access verification results</a>{" "}
            (separate publisher-access audit)
          </li>
          <li>
            <a href="https://github.com/Jaclenga/tbdataexplorer/actions/workflows/discovery.yml">
              Scheduled run history and report artifacts
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}
function PublisherScan({
  run,
  report,
}: {
  run: PortalRun;
  report: DiscoveryReport;
}) {
  return (
    <details className="publisher-scan">
      <summary>
        {publisherName(run.portalId)}: {run.itemsScanned} services scanned;{" "}
        {run.datasetsFound} datasets discovered;{" "}
        {run.complete ? "Complete scan" : "Partial scan"}; {run.issues.length}{" "}
        issues; last successful check{" "}
        {displayStatusDate(publisherLastCheck(report, run.portalId), true)}
      </summary>
      <p>
        Last successful endpoint check:{" "}
        {displayStatusDate(publisherLastCheck(report, run.portalId))}.
      </p>
      <p>
        Scan attempted {displayStatusDate(run.startedAt)}; finished{" "}
        {displayStatusDate(run.finishedAt)}. {run.layersInspected} layers
        inspected.{" "}
        {run.totalItems === null
          ? "Total service count not reported."
          : `${run.totalItems} services reported by publisher.`}
      </p>
      {groupedIssues(run).map((issue, index) => (
        <div key={index}>
          <p>
            {issue.label}
            {issue.count > 1 ? ` (${issue.count} occurrences)` : ""}.
          </p>
          <details>
            <summary>Technical explanation</summary>
            <p>{issue.message}</p>
            {issue.endpoints.length > 0 && (
              <ul>
                {issue.endpoints.map((endpoint) => (
                  <li key={endpoint}>
                    <code>{endpoint}</code>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </div>
      ))}
      {!run.issues.length && <p>No issues recorded.</p>}
    </details>
  );
}
