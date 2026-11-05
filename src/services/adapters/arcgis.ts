import { getMetadata, getPage } from "../arcgis";
import type { SourceAdapter } from "./types";

export const arcgisAdapter: SourceAdapter = {
  id: "arcgis",
  inspect: getMetadata,
  page: (dataset, metadata, request) =>
    getPage(
      dataset,
      {
        ...metadata,
        maxRecordCount: Math.min(metadata.maxRecordCount, request.limit ?? 100),
      },
      request.offset ?? 0,
      request.signal,
      request.bounds,
      request.previousIds,
      request.filter,
    ),
};
