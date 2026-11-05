import type { Dataset } from "../types";
import { endpoint } from "../services/arcgis";
import { DatasetProvenance } from "./DatasetProvenance";

export default function DatasetHeader({ dataset }: { dataset: Dataset }) {
  return (
    <>
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
    </>
  );
}
