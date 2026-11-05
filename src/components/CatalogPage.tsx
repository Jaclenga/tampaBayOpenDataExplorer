import { useMemo } from "react";
import type { Catalog } from "../types";
import type { AccessReport } from "../services/access";
import {
  searchCatalog,
  sortCatalog,
  catalogSorts,
  type Filters,
} from "../services/catalog";
import DatasetCard from "./DatasetCard";
import FilterPanel from "./FilterPanel";
import type { DiscoveryReport } from "../services/discovery/types";
import { proxyEligible } from "../services/arcgis-transport";
import DiscoveryStatus from "./DiscoveryStatus";
import type { useCatalogBrowse } from "../hooks/useCatalogBrowse";

const empty: Filters = { query: "", publisher: "", category: "", spatial: "" };
interface Props extends ReturnType<typeof useCatalogBrowse> {
  catalog: Catalog;
  access: AccessReport;
  discovery: DiscoveryReport;
}

function focusResults() {
  document.getElementById("catalog")?.scrollIntoView({ block: "start" });
  document.getElementById("results-heading")?.focus({ preventScroll: true });
}

export default function CatalogPage({
  catalog,
  access,
  filters,
  onChange,
  discovery,
  sort,
  onSort,
  visible,
  onMore,
  expanded,
  onExpand,
}: Props) {
  const results = useMemo(
    () => sortCatalog(searchCatalog(catalog.datasets, filters), sort),
    [catalog, filters, sort],
  );
  const sourceOnly = new Set(
    access.datasets
      .filter(
        (entry) =>
          entry.status === "source-only" &&
          !proxyEligible(
            catalog.datasets.find((dataset) => dataset.id === entry.id)!,
          ),
      )
      .map((entry) => entry.id),
  );
  const categories = new Set(catalog.datasets.map((d) => d.category));
  const topics = [
    "Transportation",
    "Recreation",
    "Housing",
    "Environment",
  ].filter((topic) => categories.has(topic));
  function browse(selection: Partial<Filters>) {
    onChange({ ...empty, ...selection });
    focusResults();
  }
  return (
    <main id="main">
      <section className="hero" aria-labelledby="catalog-title">
        <div className="shell">
          <h1 id="catalog-title">
            Tampa Bay <span>Open Data Explorer</span>
          </h1>
          <p>Public Datasets From the Tampa Bay Area</p>

          <div className="topics" aria-label="Browse by topic">
            <span>Topics</span>
            {topics.map((topic) => (
              <button key={topic} onClick={() => browse({ category: topic })}>
                {topic}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section
        id="catalog"
        className="shell catalog"
        aria-labelledby="results-heading"
      >
        <div className="section-top">
          <h2 id="results-heading" tabIndex={-1}>
            Browse datasets
          </h2>
        </div>
        <DiscoveryStatus report={discovery} />
        <div className="catalog-layout">
          <FilterPanel
            datasets={catalog.datasets}
            filters={filters}
            onChange={onChange}
            onReset={() => onChange(empty)}
            matchCount={results.length}
          />
          <div className="catalog-results">
            <form
              role="search"
              className="search catalog-search"
              onSubmit={(event) => {
                event.preventDefault();
                focusResults();
              }}
            >
              <label className="sr-only" htmlFor="dataset-search">
                Search datasets
              </label>
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                id="dataset-search"
                type="search"
                placeholder="Search datasets"
                value={filters.query}
                onChange={(event) =>
                  onChange({ ...filters, query: event.target.value })
                }
              />
              {filters.query && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => {
                    onChange({ ...filters, query: "" });
                    document.getElementById("dataset-search")?.focus();
                  }}
                >
                  Clear search
                </button>
              )}
              <button type="submit">Search</button>
            </form>
            <div className="results-bar">
              <p role="status">
                <strong>{results.length}</strong> datasets
                {Object.values(filters).some(Boolean) ? " found" : ""}
              </p>
              <label className="catalog-sort">
                Sort by{" "}
                <select
                  value={sort}
                  onChange={(event) =>
                    onSort(event.target.value as Props["sort"])
                  }
                >
                  {Object.entries(catalogSorts).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {Object.values(filters).some(Boolean) && (
              <p
                className="active-filters"
                aria-label="Active search and filters"
              >
                {[
                  filters.query && `Search: ${filters.query}`,
                  filters.publisher,
                  filters.category,
                  filters.spatial,
                  filters.platform,
                ]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            )}
            <div className="cards">
              {results.slice(0, visible).map((dataset) => (
                <DatasetCard
                  key={dataset.id}
                  dataset={dataset}
                  sourceOnly={sourceOnly.has(dataset.id)}
                  expanded={expanded.has(dataset.id)}
                  onExpand={() => onExpand(dataset.id)}
                />
              ))}
            </div>
            {results.length > visible && (
              <button className="button secondary" onClick={onMore}>
                Show more datasets ({results.length - visible} remaining)
              </button>
            )}
            {!results.length && (
              <div className="empty">
                <h3>No datasets match these filters.</h3>
                <p>Try another search or clear the filters.</p>
                <button className="button" onClick={() => onChange(empty)}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
