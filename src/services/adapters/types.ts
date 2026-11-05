import type { Dataset, LayerMetadata, Page } from "../../types";
import type { Bounds } from "../arcgis";
import type { RecordFilter } from "../record-filter";

export interface PageRequest {
  offset?: number;
  bounds?: Bounds;
  filter?: RecordFilter;
  previousIds?: Set<string>;
  limit?: number;
  signal?: AbortSignal;
}
export interface SourceAdapter {
  id: string;
  inspect: (dataset: Dataset, signal?: AbortSignal) => Promise<LayerMetadata>;
  page: (
    dataset: Dataset,
    metadata: LayerMetadata,
    request: PageRequest,
  ) => Promise<Page>;
}
