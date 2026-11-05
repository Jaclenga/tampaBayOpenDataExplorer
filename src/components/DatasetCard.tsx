import { useId } from "react";
import type { Dataset } from "../types";
import CatalogDatasetDetails from "./CatalogDatasetDetails";
import { rExample } from "../services/r-code";

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
  const example = rExample(dataset);
  return (
    <article className="dataset-card">
      <div className="dataset-row">
        <div className="dataset-summary">
          <h3>
            <a href={url}>{dataset.title}</a>
          </h3>
          <div className="dataset-meta">
            <span>{dataset.publisher}</span>
            <span>{dataset.category ?? "Uncategorized"}</span>
            <span>
              {dataset.geometryType === "none" ? "Table" : "Map layer"}
            </span>
            <span className="dataset-origin">
              {example.supported && example.checked
                ? "Package-supported"
                : dataset.validationStatus === "discovered"
                  ? "Discovered"
                  : "Curated"}
            </span>
          </div>
          <p className="description">
            {dataset.description ?? "Description unavailable."}
          </p>
        </div>
        <button
          className="text-button dataset-expand"
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "Hide" : "Show"} details for ${dataset.title}`}
          onClick={onExpand}
        >
          {expanded ? "Hide details" : "Details"}
        </button>
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
