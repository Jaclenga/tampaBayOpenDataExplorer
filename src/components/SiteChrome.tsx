function MainNavigation() {
  return (
    <nav aria-label="Main navigation">
      <a href="#catalog">Browse data</a>
      <a href="https://github.com/Jaclenga/tbdataexplorer">GitHub</a>
    </nav>
  );
}

export function SiteHeader({ catalog = false }: { catalog?: boolean }) {
  if (catalog)
    return (
      <header className="hero" aria-labelledby="catalog-title">
        <div className="shell">
          <div className="hero-heading-row">
            <h1 id="catalog-title">
              Explore public data across <span>Tampa Bay.</span>
            </h1>
            <MainNavigation />
          </div>
          <p>
            Discover and access public datasets from local governments across
            the Tampa Bay region.
          </p>
        </div>
      </header>
    );
  return (
    <header>
      <div className="shell nav">
        <MainNavigation />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer id="about">
      <div className="shell footer-grid">
        <div>
          <a className="footer-brand" href="#">
            Tampa Bay Open Data Explorer
          </a>
          <p>
            Catalog of government-published datasets from the Tampa Bay area
          </p>
          <p>
            Powered by{" "}
            <a href="https://jaclenga.github.io/tampaBayOpenData/">
              tampaBayOpenData
            </a>
          </p>
          <p>
            Independent and open-source. Not an official government website.
          </p>
        </div>
        <div>
          <h2>Using the data</h2>
          <p>
            Check each publisher’s terms, coverage, and update dates. Previews
            and exports include only the records you load.
          </p>
          <a href="https://jaclenga.github.io/tampaBayOpenData/articles/coverage.html">
            Coverage and source notes ↗
          </a>
        </div>
        <div>
          <h2>Project</h2>
          <a href="https://github.com/Jaclenga/tbdataexplorer">Source code ↗</a>
          <a href="https://jaclenga.github.io/tampaBayOpenData/">
            R package and documentation ↗
          </a>
          <a href="https://github.com/Jaclenga/tbdataexplorer/issues">
            Report an issue ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
