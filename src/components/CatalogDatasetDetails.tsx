import type { Dataset } from "../types";
import UseInR from "./UseInR";
import { DatasetFields, DatasetProvenance } from "./DatasetProvenance";
export default function CatalogDatasetDetails({
  dataset,
}: {
  dataset: Dataset;
}) {
  const url = `#${encodeURIComponent(dataset.id)}`;
  const layer =
    dataset.serviceUrl !== null && dataset.layerId !== null
      ? `${dataset.serviceUrl}/${dataset.layerId}`
      : null;
  return (
    <>
      <p>{dataset.description ?? "Description unavailable."}</p>
      <dl className="catalog-metadata">
        <div>
          <dt>Publisher</dt>
          <dd>{dataset.publisher}</dd>
        </div>
        <div>
          <dt>Source platform</dt>
          <dd>{(dataset.platform ?? "arcgis").toUpperCase()}</dd>
        </div>
        <div>
          <dt>Data type</dt>
          <dd>
            {dataset.geometryType === "none"
              ? "Nonspatial table"
              : dataset.geometryType}
          </dd>
        </div>
        <div>
          <dt>Dataset identifier</dt>
          <dd>
            <code>{dataset.id}</code>
          </dd>
        </div>
        <div>
          <dt>Catalog</dt>
          <dd>
            {dataset.validationStatus === "discovered"
              ? "Automatically discovered; not curator-reviewed"
              : "Curated R-package subset"}
          </dd>
        </div>
        <div>
          <dt>Package verification</dt>
          <dd>{dataset.verified ?? "Not available"}</dd>
        </div>
        <div>
          <dt>Last successful endpoint check</dt>
          <dd>
            {dataset.lastVerifiedAt
              ? new Date(dataset.lastVerifiedAt).toLocaleString()
              : "Not available"}
          </dd>
        </div>
        <div>
          <dt>
            Publisher source updated
            {dataset.sourceUpdatedKind ? ` (${dataset.sourceUpdatedKind})` : ""}
          </dt>
          <dd>
            {dataset.sourceUpdatedAt
              ? new Date(dataset.sourceUpdatedAt).toLocaleString()
              : "Not available"}
          </dd>
        </div>
        <div>
          <dt>Source URL</dt>
          <dd>
            <a href={dataset.sourceUrl}>{dataset.sourceUrl}</a>
          </dd>
        </div>
      </dl>
      <div className="catalog-actions">
        <a className="button secondary" href={url}>
          View dataset
        </a>
        {layer && dataset.geometryType !== "none" && (
          <a href={layer}>Map layer at publisher</a>
        )}
      </div>
      <DatasetProvenance dataset={dataset} />
      <DatasetFields fields={dataset.fields} />
      <UseInR dataset={dataset} />
    </>
  );
}
