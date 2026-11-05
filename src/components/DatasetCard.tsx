import { useId } from "react";
import type { Dataset } from "../types";
import CatalogDatasetDetails from "./CatalogDatasetDetails";

export default function DatasetCard({
  dataset,
  sourceOnly,
  expanded,
  onExpand,
}: {
  dataset: Dataset;
  sourceOnly: boolean;
  expanded: boolean;
  onExpand: () => void;
}) {
  const detailsId = useId();
  const url = `#${encodeURIComponent(dataset.id)}`;
  return (
    <article className={expanded ? "dataset-card is-expanded" : "dataset-card"}>
      <div className="dataset-row">
        <div className="dataset-summary">
          <h3>
            <a href={url} title={dataset.title}>
              {dataset.title}
            </a>
          </h3>
          <div className="dataset-meta">
            <span>{dataset.publisher}</span>
            <span>{dataset.category ?? "Uncategorized"}</span>
            <span>
              {dataset.geometryType === "none" ? "Table" : "Map layer"}
            </span>
          </div>
          <p className="description">
            {dataset.description ?? "Description unavailable."}
          </p>
        </div>
        <div className="dataset-row-actions">
          <a href={url} aria-label={`View dataset: ${dataset.title}`}>
            View dataset
          </a>
          <button
            className="text-button dataset-expand"
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`${expanded ? "Hide" : "Show"} details for ${dataset.title}`}
            onClick={onExpand}
          >
            <span aria-hidden="true" className="row-chevron">
              {"\u203a"}
            </span>{" "}
            Details
          </button>
        </div>
      </div>
      {sourceOnly && (
        <p className="source-only-badge">
          {"Source only \u00b7 browser preview unavailable"}
        </p>
      )}
      <div id={detailsId} hidden={!expanded} className="dataset-expanded">
        {expanded && <CatalogDatasetDetails dataset={dataset} />}
      </div>
    </article>
  );
}
