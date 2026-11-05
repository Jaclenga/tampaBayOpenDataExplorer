import { useEffect, useRef, useState } from "react";
import type { Dataset, LayerMetadata, Page } from "../types";
import { getMetadata, getPage, type Bounds } from "../services/arcgis";

const firstPage = { offsets: [0], index: 0 };
const previewLimit = 10000;

export function useDatasetPreview(dataset: Dataset) {
  const [metadata, setMetadata] = useState<LayerMetadata | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [navigation, setNavigation] = useState(firstPage);
  const [bounds, setBounds] = useState<Bounds>();
  const [retryCount, setRetryCount] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  // DatasetDetail remounts for a new dataset. Retries must retain this history;
  // only changing the area filter starts a new set of query results.
  const seen = useRef(new Map<number, Set<string>>());
  const offset = navigation.offsets[navigation.index];

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setBusy(true);
    setError("");
    setPage(null);
    setMetadata(null);
    async function inspect() {
      try {
        const result = await getMetadata(dataset, signal);
        if (!signal.aborted) setMetadata(result);
      } catch (error) {
        if (signal.aborted) return;
        setError(errorMessage(error));
        setBusy(false);
      }
    }
    void inspect();
    return () => controller.abort();
  }, [dataset, retryCount]);

  useEffect(() => {
    if (!metadata) return;
    const controller = new AbortController();
    const { signal } = controller;
    setBusy(true);
    setError("");
    setPage(null);
    const previousIds = new Set(
      [...seen.current]
        .filter(([start]) => start < offset)
        .flatMap(([, ids]) => [...ids]),
    );
    const layer = metadata;
    async function load() {
      try {
        const result = await getPage(
          dataset,
          layer,
          offset,
          signal,
          bounds,
          previousIds,
        );
        if (signal.aborted) return;
        const ids = result.records.map((record) =>
          String(record.attributes[layer.objectIdField ?? ""]),
        );
        seen.current.set(offset, new Set(ids));
        setPage(result);
      } catch (error) {
        if (!signal.aborted) setError(errorMessage(error));
      } finally {
        if (!signal.aborted) setBusy(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [dataset, metadata, offset, bounds]);

  function filterArea(area?: Bounds) {
    seen.current.clear();
    setNavigation(firstPage);
    setBounds(area);
  }

  function nextPage() {
    if (!page) return;
    const nextOffset = offset + page.records.length;
    setNavigation((current) => ({
      offsets: [...current.offsets.slice(0, current.index + 1), nextOffset],
      index: current.index + 1,
    }));
  }

  const limitReached = offset + (page?.records.length ?? 0) >= previewLimit;
  return {
    metadata,
    page,
    offset,
    bounds,
    busy,
    error,
    pageNumber: navigation.index + 1,
    limitReached,
    canGoBack: navigation.index > 0 && !busy,
    canGoForward: !!page?.hasMore && !busy && !limitReached,
    filterArea,
    nextPage,
    previousPage: () =>
      setNavigation((current) => ({
        ...current,
        index: Math.max(0, current.index - 1),
      })),
    retry: () => setRetryCount((count) => count + 1),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
