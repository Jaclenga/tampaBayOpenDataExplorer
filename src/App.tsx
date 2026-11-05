import { useEffect, useMemo, useState } from "react";
import { parseCatalog, searchCatalog, type Filters } from "./services/catalog";
import type { Catalog } from "./types";
import { parseAccessReport, type AccessReport } from "./services/access";
import DatasetDetail from "./components/DatasetDetail";
const empty: Filters = { query: "", publisher: "", category: "", spatial: "" };
function currentId() {
  try {
    const value = decodeURIComponent(location.hash.slice(1));
    return ["main", "catalog"].includes(value) ? "" : value;
  } catch {
    return "";
  }
}
export default function App() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [access, setAccess] = useState<AccessReport>();
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(empty);
  const [id, setId] = useState(currentId);
  useEffect(() => {
    const c = new AbortController();
    Promise.all(
      ["catalog.json", "access.json"].map(async (path) => {
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
          signal: c.signal,
        });
        if (!response.ok)
          throw Error(
            "Catalog or browser access information could not be loaded.",
          );
        return response.json();
      }),
    )
      .then(([catalogValue, accessValue]) => {
        const parsed = parseCatalog(catalogValue);
        const report = parseAccessReport(accessValue, parsed);
        setAccess(report);
        setCatalog(parsed);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    const change = () => {
      setId(currentId());
      if (!["#catalog", "#main"].includes(location.hash)) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title =
      id && catalog
        ? `${catalog.datasets.find((d) => d.id === id)?.title ?? "Dataset"} · Tampa Bay Open Data`
        : "Tampa Bay Open Data Explorer";
  }, [id, catalog]);
  const results = useMemo(
    () => searchCatalog(catalog?.datasets ?? [], filters),
    [catalog, filters],
  );
  const selected = catalog?.datasets.find((d) => d.id === id);
  const active = Object.values(filters).some(Boolean);
  const update = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main");
          main?.setAttribute("tabindex", "-1");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <header>
        <div className="shell nav">
          <a className="brand" href="#">
            <span className="brand-icon" aria-hidden="true">
              ≋
            </span>
            <span>
              TAMPA BAY <strong>OPEN DATA</strong>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#">Explore datasets</a>
            <a href="https://jaclenga.github.io/tampaBayOpenData/">
              R package & docs ↗
            </a>
            <a href="https://github.com/Jaclenga/tampaBayOpenDataExplorer">
              GitHub ↗
            </a>
          </nav>
        </div>
      </header>
      {error ? (
        <main id="main" className="shell">
          <p role="alert" className="error">
            {error} Refresh to try again.
          </p>
        </main>
      ) : !catalog ? (
        <main id="main" className="shell">
          <p role="status">Loading the checked dataset catalog…</p>
        </main>
      ) : selected ? (
        <DatasetDetail
          key={selected.id}
          dataset={selected}
          access={access!.datasets.find((entry) => entry.id === selected.id)!}
          checkedAt={access!.checkedAt}
        />
      ) : id ? (
        <main id="main" className="shell">
          <h1>Dataset not found</h1>
          <a href="#">Return to the catalog</a>
        </main>
      ) : (
        <main id="main">
          <section className="hero">
            <div className="shell hero-grid">
              <div>
                <div className="eyebrow light">
                  <span className="status-dot" /> PUBLIC DATA. SHARED
                  POSSIBILITIES.
                </div>
                <h1>
                  Your region.
                  <br />
                  Your data.
                  <br />
                  <em>Start exploring.</em>
                </h1>
                <p>
                  Discover the places, projects, and public services shaping
                  Tampa Bay. Open government data, brought together in one
                  place.
                </p>
                <a className="hero-link" href="#catalog">
                  Explore the collection <span>↓</span>
                </a>
              </div>
              <div className="region-art" aria-hidden="true">
                <div className="contour c1" />
                <div className="contour c2" />
                <div className="contour c3" />
                <div className="bay-shape" />
                <span className="place tampa">● TAMPA</span>
                <span className="place clearwater">● CLEARWATER</span>
                <span className="place stpete">● ST. PETERSBURG</span>
                <span className="water-label">
                  TAMPA
                  <br />
                  BAY
                </span>
                <div className="coordinate">
                  27.9506° N &nbsp; 82.4572° W<br />
                  <span>ILLUSTRATIVE REGIONAL VIEW</span>
                </div>
              </div>
            </div>
            <div className="shell stats">
              <div>
                <strong>{catalog.datasets.length}</strong>
                <span>checked datasets</span>
              </div>
              <div>
                <strong>
                  {new Set(catalog.datasets.map((d) => d.publisher)).size}
                </strong>
                <span>public publishers</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>free to explore</span>
              </div>
              <p>
                Built on the open-source
                <br />
                <a href="https://github.com/Jaclenga/tampaBayOpenData">
                  tampaBayOpenData R package ↗
                </a>
              </p>
            </div>
          </section>
          <section id="catalog" className="shell catalog">
            <div className="section-top">
              <div>
                <div className="eyebrow">THE REGIONAL COLLECTION</div>
                <h2>Find your next discovery.</h2>
              </div>
              <p className="muted">
                Search the catalog. Preview from the source.
              </p>
            </div>
            <label className="search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                aria-label="Search datasets"
                placeholder="Search parks, permits, transportation…"
                value={filters.query}
                onChange={(e) => update("query", e.target.value)}
              />
              <kbd aria-hidden="true">SEARCH</kbd>
            </label>
            <div className="catalog-layout">
              <aside aria-label="Dataset filters">
                <div className="filter-title">
                  <h3>Refine results</h3>
                  {active && (
                    <button
                      className="text-button"
                      onClick={() => setFilters(empty)}
                    >
                      Reset all
                    </button>
                  )}
                </div>
                <label>
                  Publisher
                  <select
                    value={filters.publisher}
                    onChange={(e) => update("publisher", e.target.value)}
                  >
                    <option value="">All publishers</option>
                    {[...new Set(catalog.datasets.map((d) => d.publisher))]
                      .sort()
                      .map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                  </select>
                </label>
                <label>
                  Category
                  <select
                    value={filters.category}
                    onChange={(e) => update("category", e.target.value)}
                  >
                    <option value="">All categories</option>
                    {[
                      ...new Set(
                        catalog.datasets
                          .map((d) => d.category)
                          .filter((c): c is string => !!c),
                      ),
                    ]
                      .sort()
                      .map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                  </select>
                </label>
                <label>
                  Data type
                  <select
                    value={filters.spatial}
                    onChange={(e) => update("spatial", e.target.value)}
                  >
                    <option value="">All data types</option>
                    <option value="spatial">Spatial datasets</option>
                    <option value="nonspatial">Nonspatial tables</option>
                  </select>
                </label>
                <div className="catalog-note">
                  <span aria-hidden="true">◎</span>
                  <h4>Public data, in context.</h4>
                  <p>
                    This is a checked selection, not a complete inventory.
                    Availability and reuse terms vary by source.
                  </p>
                </div>
              </aside>
              <div>
                <div className="results-bar">
                  <p role="status">
                    <strong>{results.length}</strong> datasets{" "}
                    {active ? "found" : "to explore"}
                  </p>
                  <span className="muted">CHECKED COLLECTION</span>
                </div>
                <div className="cards">
                  {results.map((d) => (
                    <article className="dataset-card" key={d.id}>
                      <div className="card-top">
                        <span className="category">
                          {d.category ?? "Uncategorized"}
                        </span>
                        <span className="geometry">
                          {d.geometryType === "none" ? "▤ Table" : "◎ Spatial"}
                        </span>
                      </div>
                      {access!.datasets.find((entry) => entry.id === d.id)
                        ?.status === "source-only" && (
                        <p className="source-only-badge">
                          Source only · browser preview unavailable
                        </p>
                      )}
                      <p className="publisher">{d.publisher}</p>
                      <h3>
                        <a href={`#${encodeURIComponent(d.id)}`}>{d.title}</a>
                      </h3>
                      <p className="description">
                        {d.description ?? "Description unavailable."}
                      </p>
                      <div className="card-bottom">
                        <span>Checked {d.verified ?? "unknown"}</span>
                        <a
                          href={`#${encodeURIComponent(d.id)}`}
                          aria-label={`Explore ${d.title}`}
                        >
                          Explore <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
                {!results.length && (
                  <div className="empty">
                    <h3>No datasets match these filters.</h3>
                    <p>Try a broader search or clear your filters.</p>
                    <button
                      className="button"
                      onClick={() => setFilters(empty)}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      )}
      <footer className="shell">
        <div className="brand">TAMPA BAY OPEN DATA EXPLORER</div>
        <p>
          Public sources. Open possibilities.
          <br />
          Check source terms and accuracy before using data.
        </p>
        <a href="https://jaclenga.github.io/tampaBayOpenData/">
          Documentation ↗
        </a>
      </footer>
    </>
  );
}
