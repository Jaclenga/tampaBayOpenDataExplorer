# Tampa Bay Open Data Explorer

A federated civic data portal for discovering public Tampa Bay datasets and exploring live publisher records. The 52 checked datasets in [tampaBayOpenData](https://github.com/Jaclenga/tampaBayOpenData) remain a curated subset alongside automatically discovered layers from six registered government portals. React, TypeScript, Vite, Tailwind CSS, Fuse.js, MapLibre GL JS, and Zod run on Cloudflare Pages, with two small Pages Functions for metadata-index delivery and an allowlisted CORS fallback. No accounts, database, paid APIs, or replicated record store.

## Run locally

Use Node.js 24 and npm. The committed catalog works without installing R or contacting government services for discovery.

```sh
npm ci
npm run dev
```

Open the printed local URL. Search and filter the catalog, choose a dataset, then preview live records. Dataset URLs use hash routes, which work on static hosting without a rewrite rule. The interface uses a navy/coral palette inspired by Tampa.dev and a search-first browsing structure inspired by NYC Open Data. It is an independent project and uses its own identity.

```sh
npm run catalog:validate
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests mock government responses. The Playwright test verifies search without record requests, publisher filtering, dataset selection, a spatial preview, CSV download, GeoJSON availability, and mobile overflow. Live endpoint checks are a separate manual maintenance task, not a prerequisite for CI.

The expanded suite includes unit tests, catalog-generator integration tests using temporary local Git repositories, and desktop/mobile Chromium browser tests against a production build. Run everything with `npm run test:all`, or use `npm run test:watch` while developing. Coverage reports are written to `coverage/`; browser reports and failure traces are in `playwright-report/` and `test-results/`. See [the testing guide](docs/testing.md) for coverage boundaries, fixtures, and regression cases.

## Architecture and verified upstream interface

The inspected upstream commit is recorded in `public/catalog.json`. Initial implementation inspected commit `2ef47d2f007e7d4f887b103990b893bbf6e7ddae` (package 0.1.0): `README.md`, `NAMESPACE`, `R/catalog.R`, `R/registry.R`, `docs/checked-catalog-policy.md`, and the package documentation sources. The package exports `tbod_list_datasets(source = "checked")`, `tbod_search_datasets()`, `tbod_dataset_info()`, `tbod_schema()`, and retrieval functions. Its default listing also performs live discovery; this app deliberately consumes the bounded checked selection.

`inst/extdata/datasets.json` is the package's authoritative checked registry. `inst/extdata/expected-schemas.json` supplies available field snapshots, keyed by `jurisdiction/id`. The generator consumes these existing public files directly rather than reimplementing R functions or copying a hand-maintained catalog. The initial collection contains all 52 checked entries across six publishers. This is a selected collection, not an exhaustive inventory of government data.

- `scripts/generate-catalog.mjs`: checks upstream shape, merges available expected fields, validates every output entry, and atomically replaces the catalog only after successful validation. No rows are silently skipped.
- `src/services/catalog.ts`: Zod validation and Fuse.js search. Search never requests ArcGIS records.
- `src/services/arcgis.ts`: live schema inspection, bounded queries, ordered pagination validation, and WGS84 geometry normalization using Terraformer (including polygon rings/holes). Small helpers handle query construction, record validation, and geometry separately.
- `src/services/http.ts`: timeouts, transient retries, cancellation, and readable HTTP/ArcGIS errors. Existing ArcGIS service exports remain compatible.
- `src/hooks/useDatasetPreview.ts`: cancellable metadata/page lifecycle, pagination history, and area-filter state. Only the active page is retained as records. Previously seen object IDs detect repeated pages.
- `src/components/DatasetDetail.tsx`: assembles the detail view from focused records, provenance, schema, and download components.
- `src/components/DatasetMap.tsx`: lazy-loaded MapLibre map, point/line/polygon rendering, fit to loaded features, click attributes, and explicit map-area queries.
- `src/services/export.ts`: loaded-page CSV and WGS84 GeoJSON. CSV escapes quotes/newlines and neutralizes formula-like cells for spreadsheet safety.

Descriptions, categories, publisher attribution, verification dates, terms, and scope notes come from upstream. Missing coverage is explicitly `null`; jurisdiction is shown separately and is not presented as exact coverage. Missing fields are `null` until live inspection. Registry verification dates describe structural checks, not record freshness or accuracy. Publisher data terms are distinct from this application's MIT code license.

## Regenerate and maintain the catalog

```sh
git clone https://github.com/Jaclenga/tampaBayOpenData.git .upstream
git -C .upstream checkout 2ef47d2f007e7d4f887b103990b893bbf6e7ddae
npm run catalog:generate
npm run catalog:validate
```

Set `TBOD_SOURCE` to use another package checkout. `scripts/generate_catalog.R` is an optional convenience wrapper around the same Node generator; R is not required. A fixed upstream commit reproduces dataset content; `generatedAt` records the current generation time. For updates, fetch upstream, select a reviewed commit, regenerate, inspect the complete diff, run checks, and commit the catalog with its new upstream SHA. Do not edit generated metadata by hand. New upstream shapes fail visibly. The generator retains the previous catalog on failure; a failed pending file is ignored by the app.

`TBOD_OUTPUT` optionally sets a different output path, used by integration tests to keep the committed catalog untouched.

After changing the catalog, refresh `public/access.json` with `npm run access:audit` and validate it with `npm run access:validate`. This explicit maintenance command checks metadata and at most one record per endpoint from the production browser origin, with two concurrent requests. It records source-only failures instead of removing datasets. Review and commit both snapshots together. Routine CI validates the saved report without making publisher requests.

The weekly/manual catalog workflow generates against upstream main and fails if dataset content differs, attaching an artifact for review. It never silently publishes a changed or partial collection. Normal CI uses the committed snapshot and makes no government requests.

## Reliability and limits

Each ArcGIS metadata or query attempt has a 15-second timeout. Only HTTP 408/429/selected 5xx, transient ArcGIS errors, and timeouts retry, at most twice with 400/800 ms backoff. `Retry-After` takes precedence; waits over five seconds surface the error instead of retrying early. Navigation cancels outstanding requests. Browser network failures cannot reliably be distinguished from CORS restrictions. Only registered Tampa layers at the demonstrated CORS-blocked host can fall back to the same-origin Worker; authentication failures never trigger a proxy bypass.

Live metadata controls query support, object ID, record limit, and pagination. Pages contain at most `min(100, maxRecordCount)` records. Reliable pagination requires explicit pagination and order-by support plus an object ID. Unsupported endpoints get an initial bounded preview and explanation; further pages are disabled. Missing/duplicate/repeated IDs, oversized pages, and contradictory empty pages stop retrieval. Preview navigation stops at 10,000 records. The publisher can still change records between page requests; previews are not transactionally consistent snapshots.

The app requests ArcGIS JSON with `outSR=4326`. It validates both response-level and feature-level CRS, longitude/latitude ranges, coordinate nesting, minimum line/ring lengths, and polygon ring closure before enabling maps or GeoJSON. Invalid geometry leaves table records available with an explicit warning. Null geometry remains null in exports and is omitted from the map. Nonspatial tables have no map. Map-area search uses an explicit WGS84 envelope and returns another bounded page; unsupported spatial requests surface publisher errors. Rejected requests do not trigger a whole-layer fallback. Table sorting affects the current page only. Feature attributes are available in the table for keyboard users as well as through map clicks.

Exports always contain only loaded records. No total count or complete-dataset export is claimed. When the publisher omits a transfer-limit flag, a full page conservatively enables another page; an empty subsequent page is possible. Source field types are displayed; raw primitive attribute values are preserved rather than guessing time zones, date formats, or missing values.

Basemap tiles come directly from OpenStreetMap with visible attribution. Tiles and ArcGIS calls require publisher availability. No tile prefetching or bulk downloads. See [OpenStreetMap's tile policy](https://operations.osmfoundation.org/policies/tiles/) before scaling traffic; a different public tile provider may become appropriate at higher usage.

**Historical direct-browser access audit:** all 52 curated datasets were checked from the production origin on November 4, 2026. Metadata and a one-record query succeeded for 31; 20 Tampa layers failed browser metadata requests, and Clearwater critical assets returned ArcGIS 499 (Token Required). The saved audit remains unchanged as historical evidence. Tampa now attempts live direct access with an allowlisted proxy fallback. Restricted sources retain the source-only panel. Newly discovered layers have their own endpoint-verification timestamps and do not inherit an audit result. `npm run access:audit -- [site-url] [output-file]` refreshes the curated audit; `node scripts/live-smoke.mjs [site-url]` checks the deployed index and real previews.

Source-only details distinguish restricted access, timeouts, server errors, and ambiguous browser/network failures. A user can explicitly recheck metadata and at most one record, with a 30-second total deadline and cancellation on navigation. No automatic publisher request occurs just from opening the page. A successful check offers the regular preview for that visit; it does not change the shared audit. The endpoint can be copied, with selectable text as a fallback if clipboard access is denied.

## Cloudflare Pages deployment

Build command: `npm run build`. Output directory: `dist`. Node version: 24. `wrangler.jsonc` defines the Pages project. Static security headers are in `public/_headers`; HTTPS connections are allowed for diverse government endpoints. No secrets enter the browser bundle.

For an existing authenticated Cloudflare account:

```sh
npx wrangler whoami
npx wrangler pages project create tampabay-open-data-explorer --production-branch=main
npm run deploy
```

Create the project only once. The manual `deploy.yml` workflow runs validation and tests before deploying. Set repository/environment secrets `CLOUDFLARE_API_TOKEN` (account Pages Edit scope) and `CLOUDFLARE_ACCOUNT_ID`. Alternatively configure Pages Git integration with the build/output settings above. Use one deployment approach consistently. [Cloudflare direct-upload documentation](https://developers.cloudflare.com/pages/get-started/direct-upload/) describes Wrangler deployment and the limitations of switching a Direct Upload project to Git integration.

The initial deployment is live at https://tampabay-open-data-explorer.pages.dev. The project already exists; use `npm run deploy` for updates. In the installed Wrangler 4.157.0, initial creation required `--force` to bypass Workers delegation; this flag is unnecessary for the existing project and subsequent deploys. To run the mocked browser workflow against hosted assets, set `E2E_BASE_URL` to the deployed URL before `npm run test:e2e`.

Static hosting fits Cloudflare Pages' free tier at low traffic; no paid service is required. Domain registration and future traffic beyond provider limits are separate. Review [Cloudflare's limits](https://developers.cloudflare.com/pages/platform/limits/) when scaling.

## Scope

Discovery and live record queries are separate: search uses catalog metadata; opening a dataset queries its publisher. Complete exports, user accounts, historical record storage, joins, analytics dashboards, and AI features remain outside scope. See [federation operations](docs/federation.md), [the architectural audit](docs/federation-plan.md), and `docs/implementation.md` for earlier verification evidence.
