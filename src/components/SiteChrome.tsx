export function SiteHeader() {
  return (
    <header>
      <div className="shell nav">
        <a className="brand" href="#" aria-label="Tampa Bay Open Data home">
          <svg
            className="brand-icon"
            viewBox="0 0 32 32"
            width="34"
            height="34"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 2h11v11H2zM19 2h11v11H19zM2 19h11v11H2z"
              fill="currentColor"
            />
            <path d="M19 19h11v11H19z" fill="#e85a4f" />
          </svg>
          <span>
            Tampa Bay <strong>Open Data</strong>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#catalog">Browse data</a>
          <a href="#publishers">Publishers</a>
          <a href="#about">About this project</a>
          <a href="https://jaclenga.github.io/tampaBayOpenData/">
            Documentation ↗
          </a>
        </nav>
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
            Tampa Bay Open Data
          </a>
          <p>
            Catalog of government-published datasets from the Tampa Bay area
          </p>
          <p>
            Independent and open source. Not an official government website.
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
          <a href="https://github.com/Jaclenga/tampaBayOpenDataExplorer">
            Source code ↗
          </a>
          <a href="https://jaclenga.github.io/tampaBayOpenData/">
            R package and documentation ↗
          </a>
          <a href="https://github.com/Jaclenga/tampaBayOpenDataExplorer/issues">
            Report an issue ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
