import { useEffect, useState } from "react";
import { parseCatalog, type Filters } from "./services/catalog";
import type { Catalog } from "./types";
import { parseAccessReport, type AccessReport } from "./services/access";
import DatasetDetail from "./components/DatasetDetail";
import CatalogPage from "./components/CatalogPage";
import { SiteHeader, SiteFooter } from "./components/SiteChrome";
const empty: Filters = { query: "", publisher: "", category: "", spatial: "" };
function currentId() {
  try {
    const value = decodeURIComponent(location.hash.slice(1));
    return ["main", "catalog", "publishers", "about"].includes(value)
      ? ""
      : value;
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
      if (
        !["#catalog", "#main", "#publishers", "#about"].includes(location.hash)
      )
        window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title =
      id && catalog
        ? `${catalog.datasets.find((d) => d.id === id)?.title ?? "Dataset"} · Tampa Bay Open Data`
        : "Tampa Bay Open Data";
  }, [id, catalog]);
  useEffect(() => {
    if (["#catalog", "#publishers", "#about"].includes(location.hash)) {
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ block: "start" });
    }
  }, [id, catalog]);
  const selected = catalog?.datasets.find((d) => d.id === id);
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
      <SiteHeader />
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
        <CatalogPage
          catalog={catalog}
          access={access!}
          filters={filters}
          onChange={setFilters}
        />
      )}
      <SiteFooter />
    </>
  );
}
