import type { Dataset } from "../types";
import type { DatasetAccess } from "../services/access";
import { useDatasetPreview } from "../hooks/useDatasetPreview";
import DatasetRecords from "./DatasetRecords";
import DownloadMenu from "./DownloadMenu";
import { DatasetFields } from "./DatasetProvenance";
import DatasetHeader from "./DatasetHeader";
import SourceOnlyDataset from "./SourceOnlyDataset";

export default function DatasetDetail({
  dataset,
  access,
  checkedAt,
}: {
  dataset: Dataset;
  access: DatasetAccess;
  checkedAt: string;
}) {
  if (access.status === "source-only")
    return (
      <SourceOnlyDataset
        dataset={dataset}
        access={access}
        checkedAt={checkedAt}
      />
    );
  return <PreviewableDataset dataset={dataset} />;
}

function PreviewableDataset({ dataset }: { dataset: Dataset }) {
  const preview = useDatasetPreview(dataset);
  const { page, metadata, offset, bounds, busy, error, pageNumber } = preview;
  const fields = metadata?.fields ?? dataset.fields;
  return (
    <main id="main" className="detail shell">
      <DatasetHeader dataset={dataset} />
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
