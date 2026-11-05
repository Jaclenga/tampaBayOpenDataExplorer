import type { Dataset } from "../types";
import { endpoint } from "../services/arcgis";
import { useDatasetPreview } from "../hooks/useDatasetPreview";
import DatasetRecords from "./DatasetRecords";
import DownloadMenu from "./DownloadMenu";
import { DatasetFields, DatasetProvenance } from "./DatasetProvenance";

export default function DatasetDetail({ dataset }: { dataset: Dataset }) {
  const preview = useDatasetPreview(dataset);
  const { page, metadata, offset, bounds, busy, error, pageNumber } = preview;
  const fields = metadata?.fields ?? dataset.fields;
  return (
    <main id="main" className="detail shell">
      <a href="#" className="back">
        ← All datasets
      </a>
      <div className="eyebrow">
        {dataset.publisher}{" "}
        <span> / {dataset.category ?? "Uncategorized"}</span>
      </div>
      <h1>{dataset.title}</h1>
      <p className="detail-description">
        {dataset.description ?? "Description unavailable."}
      </p>
      <div className="source-line">
        <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">
          Original source ↗
        </a>
        <a
          href={`${endpoint(dataset)}?f=pjson`}
          target="_blank"
          rel="noreferrer"
        >
          ArcGIS endpoint ↗
        </a>
        <span>Structure checked {dataset.verified ?? "unknown"}</span>
      </div>
      <DatasetProvenance dataset={dataset} />
      <section className="preview" aria-busy={busy}>
        <div className="section-top">
          <div>
            <div className="eyebrow">LIVE FROM THE PUBLISHER</div>
            <h2>Explore the data</h2>
          </div>
          <DownloadMenu
            page={page}
            fields={metadata?.fields ?? []}
            filename={`${dataset.packageId}-page-${pageNumber}`}
            busy={busy}
          />
        </div>
        <p className="muted">
          Exports contain only this loaded page, including any map-area filter.
          They are not complete dataset downloads.
        </p>
        {busy && (
          <p role="status" className="notice">
            Connecting to the publisher and loading a bounded preview…
          </p>
        )}
        {error && (
          <div role="alert" className="error">
            <p>{error}</p>
            <button className="button secondary" onClick={preview.retry}>
              Try again
            </button>
          </div>
        )}
        {bounds && (
          <p className="notice">
            Map-area filter applied.{" "}
            <button onClick={() => preview.filterArea()}>
              Clear area filter
            </button>
          </p>
        )}
        <DatasetRecords
          page={page}
          fields={metadata?.fields ?? []}
          offset={offset}
          onBounds={preview.filterArea}
        />
        <div className="pagination">
          <button
            className="button secondary"
            disabled={!preview.canGoBack}
            onClick={preview.previousPage}
          >
            ← Previous
          </button>
          <span>Page {pageNumber}</span>
          <button
            className="button secondary"
            disabled={!preview.canGoForward}
            onClick={preview.nextPage}
          >
            Next →
          </button>
        </div>
        {page && preview.limitReached && (
          <p>
            Preview navigation is limited to 10,000 records. Narrow the map area
            or visit the source.
          </p>
        )}
      </section>
      <DatasetFields fields={fields} />
    </main>
  );
}
