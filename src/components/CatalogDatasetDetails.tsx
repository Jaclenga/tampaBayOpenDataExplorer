import type { Dataset } from "../types";
import {
  geometryLabel,
  type catalogAccessStatus,
} from "../services/catalog-presentation";
import UseInR from "./UseInR";
import { DatasetFields, DatasetProvenance } from "./DatasetProvenance";
export default function CatalogDatasetDetails({
  dataset,
  sourceOnly,
  status,
}: {
  dataset: Dataset;
  sourceOnly: boolean;
  status: ReturnType<typeof catalogAccessStatus>;
}) {
  const url = `#${encodeURIComponent(dataset.id)}`;
  const layer =
    dataset.serviceUrl !== null && dataset.layerId !== null
      ? `${dataset.serviceUrl}/${dataset.layerId}`
      : null;
  return (
    <>
      <CatalogPreviewNote sourceOnly={sourceOnly} status={status} />
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
          <dd>{geometryLabel(dataset.geometryType)}</dd>
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
              ? "Publisher portal"
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
        <a href={url}>View dataset</a>
        {layer && dataset.geometryType !== "none" && (
          <a href={layer}>Map layer at publisher</a>
        )}
      </div>
      <CategoryAssignment dataset={dataset} />
      <DatasetProvenance dataset={dataset} />
      <DatasetFields fields={dataset.fields} />
      <UseInR dataset={dataset} />
    </>
  );
}

function CatalogPreviewNote({
  sourceOnly,
  status,
}: {
  sourceOnly: boolean;
  status: ReturnType<typeof catalogAccessStatus>;
}) {
  if (!sourceOnly && !status) return null;
  return (
    <div className="catalog-preview-status" role="note">
      <p>{status?.failed ? status.label : "Preview not available"}</p>
      {status && (
        <>
          <p>
            {status.explanation.title}. {status.explanation.description}
          </p>
          <p>Last check: {status.reason}</p>
        </>
      )}
    </div>
  );
}

function CategoryAssignment({ dataset }: { dataset: Dataset }) {
  return (
    dataset.category_source && (
      <details>
        <summary>Category assignment</summary>
        <p>
          {dataset.category ?? "Uncategorized"}; {dataset.category_source};
          rules {dataset.category_version}.
        </p>
        <p>
          Evidence tier: {dataset.category_confidence}. Tiers describe rule
          strength, not probabilities.
        </p>
        {dataset.source_category && (
          <p>Publisher category: {dataset.source_category}</p>
        )}
        <ul>
          {dataset.category_signals?.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
        {dataset.category_review && (
          <p>Review reason: {dataset.category_review} evidence.</p>
        )}
      </details>
    )
  );
}
