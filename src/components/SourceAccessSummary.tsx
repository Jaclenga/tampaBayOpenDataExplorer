import type { useAccessCheck } from "../hooks/useAccessCheck";
import { accessExplanation } from "../services/access-check";

export default function SourceAccessSummary({
  check,
  checkedAt,
}: {
  check: ReturnType<typeof useAccessCheck>;
  checkedAt: string;
}) {
  const explanation = accessExplanation(check.reason);
  const available = check.status === "available";
  const lastCheckedAt = check.checkedAt ?? checkedAt;
  return (
    <div
      className="access-summary"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={`access-label ${available ? "available" : ""}`}>
        {available ? "Preview available" : "Publisher access"}
      </span>
      <h3>{available ? "The source is responding now" : explanation.title}</h3>
      <p>
        {available
          ? "The source responded to a live preview request. You can now open a preview."
          : explanation.description}
      </p>
      {!available && <p>{explanation.nextStep}</p>}
      {check.status === "checking" && (
        <p className="access-progress">
          Checking metadata and one record. This can take up to 30 seconds;
          leaving this page cancels the check.
        </p>
      )}
      <p className="access-date">
        {check.checkedAt ? "Checked in this browser: " : "Last catalog check: "}
        <time dateTime={lastCheckedAt}>
          {new Date(lastCheckedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </time>
        . Availability can change.
      </p>
    </div>
  );
}
