import { useRef, useState, useId } from "react";
import type { Dataset } from "../types";
import { rExample } from "../services/r-code";

export default function UseInR({ dataset }: { dataset: Dataset }) {
  const headingId = useId();
  const codeId = useId();
  const [full, setFull] = useState(false);
  const [spatial, setSpatial] = useState(false);
  const [feedback, setFeedback] = useState("");
  const codeField = useRef<HTMLTextAreaElement>(null);
  const example = rExample(dataset, { full, spatial });
  async function copyCode() {
    if (!example.supported) return;
    try {
      await navigator.clipboard.writeText(example.code);
      setFeedback("R code copied.");
    } catch {
      codeField.current?.focus();
      codeField.current?.select();
      setFeedback(
        "Could not copy automatically. The code is selected; copy it using your browser or keyboard.",
      );
    }
  }
  return (
    <section className="use-in-r" aria-labelledby={headingId}>
      <h2 id={headingId}>Use in R</h2>
      {!example.supported ? (
        <p className="notice">{example.reason}</p>
      ) : (
        <>
          <p>
            Download live publisher records with <code>tampaBayOpenData</code>.
            The default example is a preview of up to 100 records.
          </p>
          <p className="muted">
            {example.checked
              ? "Uses this dataset’s checked package identifier."
              : "Uses the original ArcGIS layer URL. This discovered layer is not part of the checked package catalog."}{" "}
            Website record filters and map-area filters are not included.
            Publisher availability and access restrictions still apply; this
            code does not use the website proxy.
          </p>
          <div className="r-options">
            <label>
              <input
                type="checkbox"
                checked={full}
                onChange={(event) => {
                  setFull(event.target.checked);
                  setFeedback("");
                }}
              />{" "}
              Full retrieval (limit = Inf)
            </label>
            {example.spatialAvailable && (
              <label>
                <input
                  type="checkbox"
                  checked={spatial}
                  onChange={(event) => {
                    setSpatial(event.target.checked);
                    setFeedback("");
                  }}
                />{" "}
                Spatial data (spatial = TRUE; requires sf)
              </label>
            )}
          </div>
          {full && (
            <p className="notice" role="note">
              Large dataset warning: full retrieval can take a long time,
              consume substantial memory, or exceed publisher/package limits.
              Start with the 100-record preview and narrow large requests before
              downloading.
            </p>
          )}
          {spatial && example.spatialAvailable && (
            <p className="muted">
              The example installs the optional sf package if needed and returns
              an sf object. The publisher must provide supported geometry and
              coordinate-system metadata.
            </p>
          )}
          <label className="sr-only" htmlFor={codeId}>
            R code
          </label>
          <textarea
            id={codeId}
            className="r-code"
            ref={codeField}
            readOnly
            spellCheck={false}
            value={example.code}
            rows={Math.min(24, example.code.split("\n").length)}
          />
          <button className="button secondary" onClick={copyCode}>
            Copy Code
          </button>
          <p role="status" aria-live="polite">
            {feedback}
          </p>
        </>
      )}
      <a
        href="https://jaclenga.github.io/tampaBayOpenData/"
        target="_blank"
        rel="noreferrer"
      >
        R package documentation ↗
      </a>
    </section>
  );
}
