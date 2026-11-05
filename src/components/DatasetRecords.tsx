import { lazy, Suspense } from "react";
import type { Field, Page } from "../types";
import type { Bounds } from "../services/arcgis";
import DatasetTable from "./DatasetTable";

const DatasetMap = lazy(() => import("./DatasetMap"));

interface Props {
  page: Page | null;
  fields: Field[];
  offset: number;
  onBounds: (bounds: Bounds) => void;
}

export default function DatasetRecords({
  page,
  fields,
  offset,
  onBounds,
}: Props) {
  if (!page) return null;
  const count = page.records.length;
  return (
    <>
      {page.warning && (
        <p role="status" className="notice">
          {page.warning}
        </p>
      )}
      {page.geojson && (
        <Suspense fallback={<p role="status">Loading map…</p>}>
          <DatasetMap data={page.geojson} onBounds={onBounds} />
        </Suspense>
      )}
      <div className="record-count">
        {count} records loaded
        {count > 0 && ` · rows ${offset + 1}–${offset + count}`} · preview only
      </div>
      <DatasetTable records={page.records} fields={fields} />
    </>
  );
}
