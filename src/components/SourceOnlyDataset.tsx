import { useRef, useState } from "react";
import type { Dataset } from "../types";
import type { DatasetAccess } from "../services/access";
import { accessExplanation } from "../services/access-check";
import { endpoint } from "../services/arcgis";
import { useAccessCheck } from "../hooks/useAccessCheck";
import DatasetWorkspace from "./DatasetWorkspace";
import { DatasetFields } from "./DatasetProvenance";

interface Props {
  dataset: Dataset;
  access: DatasetAccess;
  checkedAt: string;
  onPreview: () => void;
}
export default function SourceOnlyDataset({
  dataset,
  access,
  checkedAt,
  onPreview,
}: Props) {
  const check = useAccessCheck(
    dataset,
    access.reason ?? "Preview unavailable.",
  );
  const explanation = accessExplanation(check.reason);
  const available = check.status === "available";
  const busy = check.status === "checking";
  const address = endpoint(dataset);
  const lastCheckedAt = check.checkedAt ?? checkedAt;
  const input = useRef<HTMLInputElement>(null);
  const [copyMessage, setCopyMessage] = useState("");
  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(address);
      setCopyMessage("Endpoint copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setCopyMessage("Select and copy the endpoint address below.");
    }
  }
  return (
    <DatasetWorkspace dataset={dataset}>
      <section
        className="preview access-section"
        aria-labelledby="access-heading"
      >
        <h2 id="access-heading">Source-only dataset</h2>
        <div className="access-panel" aria-busy={busy}>
          <div
            className="access-summary"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className={`access-label ${available ? "available" : ""}`}>
              {available ? "Preview available" : "Publisher access"}
            </span>
            <h3>
              {available ? "The source is responding now" : explanation.title}
            </h3>
            <p>
              {available
                ? "The source responded to a live preview request. You can now open a preview."
                : explanation.description}
            </p>
            {!available && <p>{explanation.nextStep}</p>}
            {busy && (
              <p className="access-progress">
                Checking metadata and one record. This can take up to 30
                seconds; leaving this page cancels the check.
              </p>
            )}
            <p className="access-date">
              {check.checkedAt
                ? "Checked in this browser: "
                : "Last catalog check: "}
              <time dateTime={lastCheckedAt}>
                {new Date(lastCheckedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
              . Availability can change.
            </p>
          </div>
          <div className="access-actions">
            {available ? (
              <button className="button" onClick={onPreview}>
                Open data preview
              </button>
            ) : (
              <button
                className="button"
                disabled={busy}
                onClick={check.recheck}
              >
                {busy ? "Checking availability…" : "Check preview availability"}
              </button>
            )}
            <a
              className="button secondary"
              href={dataset.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open publisher source ↗
            </a>
            <a
              className="access-rest-link"
              href={`${address}?f=pjson`}
              target="_blank"
              rel="noreferrer"
            >
              View ArcGIS service ↗
            </a>
          </div>
          <div className="access-endpoint">
            <label htmlFor="source-endpoint">ArcGIS layer endpoint</label>
            <div className="endpoint-control">
              <input
                id="source-endpoint"
                ref={input}
                readOnly
                value={address}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button className="button secondary" onClick={copyEndpoint}>
                Copy endpoint
              </button>
            </div>
            {copyMessage && (
              <p role="status" className="muted">
                {copyMessage}
              </p>
            )}
          </div>
          <details className="access-diagnostics">
            <summary>Check details</summary>
            <dl>
              <div>
                <dt>Check stopped at</dt>
                <dd>
                  {check.status === "idle"
                    ? access.stage
                    : "Live preview check"}
                </dd>
              </div>
              <div>
                <dt>Publisher response</dt>
                <dd>
                  {check.reason ||
                    "Metadata and a one-record query passed validation."}
                </dd>
              </div>
            </dl>
            <p>
              A successful check applies to this browser and this moment. It
              does not change the shared catalog or guarantee a complete
              download.
            </p>
          </details>
        </div>
      </section>
      <DatasetFields fields={dataset.fields} />
    </DatasetWorkspace>
  );
}
