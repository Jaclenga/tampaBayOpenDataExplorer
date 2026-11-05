import type { Field, Page } from "../types";
import { csv, download, geojson } from "../services/export";

interface Props {
  page: Page | null;
  fields: Field[];
  filename: string;
  busy: boolean;
}

export default function DownloadMenu({ page, fields, filename, busy }: Props) {
  function exportPage(format: "csv" | "geojson") {
    if (!page) return;
    const content =
      format === "csv" ? csv(page.records, fields) : geojson(page);
    const type =
      format === "csv" ? "text/csv;charset=utf-8" : "application/geo+json";
    download(content, `${filename}.${format}`, type);
  }
  return (
    <div className="exports">
      <button
        className="button secondary"
        disabled={!page || busy}
        onClick={() => exportPage("csv")}
      >
        ↓ Page CSV
      </button>
      <button
        className="button"
        disabled={!page?.geojson || busy}
        onClick={() => exportPage("geojson")}
      >
        ↓ Page GeoJSON
      </button>
    </div>
  );
}
