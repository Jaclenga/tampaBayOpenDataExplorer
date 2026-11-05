import type { DiscoveryReport } from "../services/discovery/types";
import { catalogStatus } from "../services/catalog-status";
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
      <span>
        {status.successfulAt ? (
          <>
            Last checked{" "}
            <time dateTime={status.successfulAt}>
              {new Date(status.successfulAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </>
        ) : (
          "Verification status unavailable"
        )}
      </span>
      {status.verified !== null && (
        <span>{status.verified} datasets verified</span>
      )}
      <a href="#catalog-status">Coverage details</a>
    </p>
  );
}
