import type { Dataset } from "../types";

export default function DatasetCard({
  dataset,
  sourceOnly,
}: {
  dataset: Dataset;
  sourceOnly: boolean;
}) {
  const url = `#${encodeURIComponent(dataset.id)}`;
  return (
    <article className="dataset-card">
      <p className="dataset-verification">
        {dataset.validationStatus === "discovered"
          ? "Automatically discovered · unreviewed"
          : "Curated R-package subset"}
      </p>
      <p className="publisher">{dataset.publisher}</p>
      <h3>
        <a href={url}>{dataset.title}</a>
      </h3>
      <p className="description">
        {dataset.description ?? "Description unavailable."}
      </p>
      <div className="card-bottom">
        <div className="dataset-meta">
          <span className="category">
            {dataset.category ?? "Uncategorized"}
          </span>
          <span>{dataset.geometryType === "none" ? "Table" : "Map layer"}</span>
          <span>
            {dataset.verified
              ? `Package check ${dataset.verified}`
              : dataset.lastVerifiedAt
                ? `Endpoint checked ${new Date(dataset.lastVerifiedAt).toLocaleDateString()}`
                : "Endpoint not yet verified"}
          </span>
        </div>
        <a href={url} aria-label={`View ${dataset.title}`}>
          View dataset <span aria-hidden="true">→</span>
        </a>
      </div>
      {sourceOnly && (
        <p className="source-only-badge">
          Source only · browser preview unavailable
        </p>
      )}
    </article>
  );
}
