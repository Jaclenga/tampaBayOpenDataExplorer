import type { Dataset } from "../../types";
import { canonicalEndpoint } from "../source-url";

export function datasetKey(dataset: Dataset) {
  return dataset.resource
    ? new URL(dataset.resource.url).href
    : canonicalEndpoint(`${dataset.serviceUrl}/${dataset.layerId}`);
}

export function mergeDatasets(curated: Dataset[], discovered: Dataset[]) {
  const byEndpoint = new Map<string, Dataset>();
  for (const dataset of discovered)
    if (!byEndpoint.has(datasetKey(dataset)))
      byEndpoint.set(datasetKey(dataset), dataset);
  for (const dataset of curated) {
    const key = datasetKey(dataset);
    const live = byEndpoint.get(key);
    byEndpoint.set(key, {
      ...live,
      ...dataset,
      validationStatus: "curated",
      lastVerifiedAt: live?.lastVerifiedAt ?? dataset.lastVerifiedAt,
      sourceUpdatedAt: live?.sourceUpdatedAt ?? dataset.sourceUpdatedAt,
      sourceUpdatedKind: live?.sourceUpdatedKind ?? dataset.sourceUpdatedKind,
    });
  }
  const curatedIds = new Set(curated.map((d) => d.id));
  return [
    ...curated.map((d) => byEndpoint.get(datasetKey(d))!),
    ...[...byEndpoint.values()].filter((d) => !curatedIds.has(d.id)),
  ];
}

export function preservePrevious(previous: Dataset[], current: Dataset[]) {
  const byKey = new Map(
    previous.map((dataset) => [datasetKey(dataset), dataset]),
  );
  for (const dataset of current) byKey.set(datasetKey(dataset), dataset);
  return [...byKey.values()];
}
