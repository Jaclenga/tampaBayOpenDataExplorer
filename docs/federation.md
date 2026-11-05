# Federated discovery and live records

## Architecture

The curated `public/catalog.json` and its historical `public/access.json` stay intact. `config/portals.json` independently registers six public government ArcGIS organizations and approved service prefixes. `public/discovery.json` contains generated descriptors, field metadata, per-portal scan reports, and refreshed curated metadata. It never contains source records. Canonical layer endpoints deduplicate overlapping portal items; curated IDs, titles, links and package verification dates win.

`src/services/adapters` supplies `inspect` and `page` operations for ArcGIS FeatureServer/MapServer, CKAN DataStore, Socrata's public SODA 2.x resource API, and small CSV/JSON files. The preview lifecycle selects the adapter rather than embedding platform-specific requests in React. ArcGIS retains the existing geometry validation, map previews, ordering checks and CSV/GeoJSON exports. CKAN supports equality filters; Socrata supports typed comparisons. Those adapters provide table previews; spatial mapping is currently ArcGIS-only. File previews support JSON arrays of objects and CSV with quoted/multiline cells, are capped at 1 MiB and 1,000 rows, and cannot filter at the source. They refetch the bounded file for each page and disclose the limit. No PostgreSQL or record ingestion is needed.

## Discovery refreshes

```sh
npm run discovery:refresh -- --max-items 40 --max-layers 150 --timeout-ms 900000
npm run discovery:validate
```

The budgets apply per portal, with two portals in parallel and sequential layer inspections within each. Only public items scoped to the configured organization and approved HTTPS service prefixes are expanded. Leaf layers and tables are inspected; group layers and unregistered locations are excluded. Scans sort by recently modified items, so new public services enter the bounded working set. This is deliberately not an exhaustive census: older descriptors accumulate across runs, while partial scans retain prior entries. Endpoints are not automatically removed when they disappear; inspect the verification age and report when retiring obsolete descriptors. Cross-domain aliases are not guessed during deduplication.

`.github/workflows/discovery.yml` runs daily at 08:23 UTC and supports manual dispatch. It writes a candidate index, validates schemas, runs type/lint/unit/coverage/build/browser checks, then commits **only** `public/discovery.json` to main. A concurrent push causes publication to fail instead of overwriting another commit. Failed portal searches stop publication. Endpoint failures and bounded scans remain publishable with explicit partial/error reports and retained previous descriptors. Logs, the Actions summary and a 14-day artifact expose each run, even when publication fails. Ordinary CI never contacts government services. The default GitHub token needs repository contents-write permission; branch rules may require adjusting this publication strategy to a reviewed PR.

The `/api/discovery` Pages Function fetches one fixed public GitHub raw URL, validates its schema and registered source locations, bounds it to 4 MiB and five seconds, and caches metadata for five minutes. It cannot fetch a caller-supplied URL. If unavailable, it returns the deployed bundle with a fallback header; the browser also falls back to the static index, then the curated catalog. The UI discloses fallback and partial results. A successful scheduled commit therefore becomes visible without a Pages redeploy. Forks must update the fixed repository URL in `src/server/discovery-index.ts`.

Register CKAN or Socrata portals by adding a reviewed entry with the correct platform, API root, attribution/evidence and approved resource prefixes. Their discovery adapters use CKAN `package_search` or the domain-scoped public Socrata catalog. CSV/JSON portals use an explicit `resources` manifest of public URL/id/title descriptors. No non-ArcGIS Tampa Bay portal has been registered without publisher evidence. File resources discovered through CKAN also remain restricted to the portal's approved prefixes. CKAN verification fetches at most one record to validate DataStore access; file verification reads only the bounded file. Records from verification are discarded.

## Freshness and limits

Three dates have different meanings:

- `verified`: historical R-package structural review, available only for curated entries.
- `lastVerifiedAt`: last successful application endpoint inspection. `lastAttemptedAt` and `verificationError` describe later failed curated checks. Live preview inspection has its own current timestamp.
- `sourceUpdatedAt`: publisher-provided record edit date, portal-item modification time, or resource `Last-Modified`; `sourceUpdatedKind` identifies which. A portal-item edit is never called a record update. Missing dates stay unknown.

ArcGIS pages contain at most 100 records and navigation stops at 10,000. Field filters are compiled against live metadata with validated identifiers, typed finite numbers and escaped literals. Bounds are WGS84 envelopes. Exports contain only the loaded, filtered page. Source changes between requests can change pagination; results are not a consistent full-database snapshot. Unsupported query capabilities, schema changes, invalid geometry, timeouts and rate limits surface explicit errors/warnings with original source links.

## CORS proxy trust boundary

`/api/arcgis` is a Pages Function running on Cloudflare's Worker runtime. `config/proxy.json` allows only the demonstrated Tampa CORS host/path. The browser tries the publisher first and falls back only on a network/CORS failure, never on token-required or HTTP authorization errors. The server resolves an exact registered dataset ID; newly scheduled ArcGIS IDs can be resolved from the same validated index. Unregistered IDs never become arbitrary URL requests.

The handler permits GET metadata/query operations, approved parameters, a single compiled field filter, 100 records, a 10,000-record navigation ceiling, a 2 MiB streaming response limit, and a 15-second publisher deadline. It refuses cross-origin browser calls, duplicate parameters, credentials, arbitrary URLs, non-HTTPS/private hosts, unregistered paths, redirects, edits and token parameters. Publisher `Retry-After` survives the proxy. Metadata may cache for 60 seconds; record queries are `no-store`. Structured logs record dataset ID, status and duration without filter values. There is no record cache or database. Rate limits and errors are still controlled by each publisher; proxying does not grant access to restricted data.

## Deployment and verification

`npm run build` builds the frontend; `npm run build:functions` compiles the Worker bundle and also runs in CI. `npx wrangler pages deploy dist --project-name=tampabay-open-data-explorer` compiles and deploys the sibling `functions/` directory along with assets. Use `npx wrangler pages dev dist --port 8788` to exercise the Worker runtime locally; Vite preview serves only the static fallback and cannot resolve CORS-blocked records through the function. Cloudflare fetch supports `manual` redirect handling; handlers inspect status codes instead of using Node's `redirect: error`. No secrets or database bindings are needed for runtime or scheduled discovery. Automatic code deployment remains the existing optional workflow with Cloudflare credentials; metadata publication does not require those credentials.

`npm run test:all` covers discovery paging, metadata parsing, public organization/prefix restrictions, caps and failures, deduplication/curated identity, additional adapters, typed filters, pagination, bounded file parsing, exports, proxy security, fallback behavior and desktop/mobile UI flows. `node scripts/live-smoke.mjs` is an explicit network check against production. Publisher uptime is separate from a passing mocked regression suite.

API references: [ArcGIS public item search](https://developers.arcgis.com/rest/users-groups-and-items/search/), [ArcGIS layer queries](https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/), [CKAN DataStore](https://docs.ckan.org/en/latest/maintaining/datastore.html), [Socrata text and escaping](https://dev.socrata.com/docs/datatypes/text.html), and [Cloudflare fetch/redirect behavior](https://developers.cloudflare.com/workers/runtime-apis/fetch/).
