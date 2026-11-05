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
      {status.verified !== null && (
        <>
          {" "}
          {"\u00b7"} {status.verified} datasets verified
        </>
      )}
      {" \u00b7 "}
      <a href="#catalog-status">Coverage details</a>
    </p>
  );
}
