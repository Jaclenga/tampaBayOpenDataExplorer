import type { Dataset } from "../types";
import type { DatasetAccess } from "../services/access";
import DatasetHeader from "./DatasetHeader";
import { DatasetFields } from "./DatasetProvenance";

export default function SourceOnlyDataset({
  dataset,
  access,
  checkedAt,
}: {
  dataset: Dataset;
  access: DatasetAccess;
  checkedAt: string;
}) {
  return (
    <main id="main" className="detail shell">
      <DatasetHeader dataset={dataset} />
      <section className="preview" aria-label="Publisher access information">
        <h2>Source-only dataset</h2>
        <div role="status" className="notice">
          <p>
            Browser preview is unavailable for this dataset. Visit the publisher
            for availability and download options.
          </p>
          <p>{access.reason}</p>
          <p>
            Browser access checked {new Date(checkedAt).toLocaleDateString()}.
            Publisher availability can change.
          </p>
          <a
            className="button secondary"
            href={dataset.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open publisher source ↗
          </a>
        </div>
      </section>
      <DatasetFields fields={dataset.fields} />
    </main>
  );
}
