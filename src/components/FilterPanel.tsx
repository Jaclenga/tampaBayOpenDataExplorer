import { useState } from "react";
import type { Dataset } from "../types";
import type { Filters } from "../services/catalog";

interface Props {
  datasets: Dataset[];
  filters: Filters;
  onChange: (filters: Filters) => void;
  onReset: () => void;
  matchCount: number;
}
export default function FilterPanel({
  datasets,
  filters,
  onChange,
  onReset,
  matchCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const publishers = [...new Set(datasets.map((d) => d.publisher))].sort();
  const categories = [
    ...new Set(
      datasets
        .map((d) => d.category)
        .filter((value): value is string => !!value),
    ),
  ].sort();
  const active = Object.values(filters).some(Boolean);
  return (
    <aside aria-label="Dataset filters" className="catalog-filters">
      <button
        className="filter-toggle"
        aria-expanded={open}
        aria-controls="filter-options"
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide filters" : "Show filters"} ({matchCount} matches)
      </button>
      <div
        id="filter-options"
        className={open ? "filter-options is-open" : "filter-options"}
      >
        <div className="filter-title">
          <h3>Filter datasets</h3>
          {active && (
            <button className="text-button" onClick={onReset}>
              Clear all filters
            </button>
          )}
        </div>
        <p className="filter-match-count">{matchCount} matching datasets</p>
        <label>
          Publisher
          <select
            value={filters.publisher}
            onChange={(event) =>
              onChange({ ...filters, publisher: event.target.value })
            }
          >
            <option value="">All publishers</option>
            {publishers.map((publisher) => (
              <option key={publisher}>{publisher}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={filters.category}
            onChange={(event) =>
              onChange({ ...filters, category: event.target.value })
            }
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Data type
          <select
            value={filters.spatial}
            onChange={(event) =>
              onChange({ ...filters, spatial: event.target.value })
            }
          >
            <option value="">All data types</option>
            <option value="spatial">Spatial datasets</option>
            <option value="nonspatial">Nonspatial tables</option>
          </select>
        </label>
        <label>
          Source platform
          <select
            value={filters.platform ?? ""}
            onChange={(event) =>
              onChange({ ...filters, platform: event.target.value })
            }
          >
            <option value="">All platforms</option>
            {[...new Set(datasets.map((d) => d.platform ?? "arcgis"))]
              .sort()
              .map((platform) => (
                <option key={platform} value={platform}>
                  {platform.toUpperCase()}
                </option>
              ))}
          </select>
        </label>
      </div>
    </aside>
  );
}
