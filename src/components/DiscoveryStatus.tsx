import type { DiscoveryReport } from "../services/discovery/types";
import { catalogStatus, displayStatusDate } from "../services/catalog-status";
export default function DiscoveryStatus({
  report,
  warning,
}: {
  report: DiscoveryReport;
  warning: string | null;
}) {
  const status = catalogStatus(report, warning);
  return (
    <p className="discovery-status">
      {status.successfulAt ? (
        <>
          Catalog checked{" "}
          <time dateTime={status.successfulAt}>
            {displayStatusDate(status.successfulAt, true)}
          </time>
        </>
      ) : (
        "Verification status unavailable"
      )}
      {status.verified !== null && (
        <>
          {" "}
          {"\u00b7"} {status.verified} datasets verified in latest attempt
        </>
      )}
      {" \u00b7 "}
      {status.state}
      {" \u00b7 "}
      <a href="#catalog-status">Catalog status</a>
    </p>
  );
}
