# Testing

Use Node.js 24, npm, and Git. No R installation, government access, Cloudflare credentials, or `.upstream` checkout is required to run the suite. Install dependencies with `npm ci` and the browser with `npx playwright install chromium` (Linux CI uses `--with-deps`).

## Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Unit and catalog-generator integration tests |
| `npm run test:watch` | Re-run unit/integration tests as files change |
| `npm run test:coverage` | Core-service/schema coverage with enforced thresholds |
| `npm run test:e2e` | Build, serve, and test desktop/mobile Chromium flows |
| `npm run test:all` | Catalog validation, type checking, lint, coverage, production build, and browser tests |
| `npx playwright show-report` | Open the last browser report |

To run one regression: `npm test -- tests/services/export.test.ts`, or `npm run test:e2e -- --grep "short transfer-limited" --workers=2`.

The browser server binds to `127.0.0.1:5173`, runs the Vite production build, and shuts down after the suite. Keep that port free. The runner deliberately refuses to reuse an unrelated server, so results always reflect the built source. Set `E2E_BASE_URL` only when intentionally testing already-deployed assets; this skips local serving/building. Set Playwright's `--workers=2` on constrained machines; CI defaults to two workers.

## Test layers

- `tests/core.test.ts`: original committed-catalog smoke tests and basic adapter/export contracts.
- `tests/services/catalog.test.ts`: invalid schema rejection, missing metadata, search across descriptions and tags, case/whitespace handling, filter intersections, and absence of record requests during discovery.
- `tests/services/request.test.ts`: HTTP and ArcGIS errors, exact retry timing, recovery, bounded retries, malformed JSON, real timeout-signal delivery, and cancellation during retry backoff.
- `tests/services/arcgis.test.ts`: live capability fallbacks, unsupported pagination, safe offsets, page-size caps, transfer-limit interpretation, primitive record preservation, invalid geometry, polygon holes, and multiline conversion.
- `tests/services/export.test.ts`: exact page contents, numeric values, formula protection for untrusted strings, Unicode, empty headers, null geometry, and Blob URL cleanup.
- `tests/catalog-generation.test.ts`: invokes the actual generator and validator against synthetic local Git repositories; checks all entries, field snapshots, commit provenance, and preservation of the previous output on empty, malformed, duplicate, or mismatched upstream input. Temporary output never overwrites `public/catalog.json`.
- `tests/e2e/discovery.spec.ts`: intersecting filters, reset/empty states, invalid catalog, unknown routes, and keyboard focus/navigation.
- `tests/e2e/preview.spec.ts`: sortable nonspatial data, short pages, backward navigation, failed-page recovery, unsupported capabilities, successful/rejected map-area queries, empty responses, and downloaded CSV/GeoJSON contents.
- `tests/e2e/explorer.spec.ts`: actual map rendering/feature selection and end-to-end discovery through export against the committed catalog.
- `tests/e2e/mobile.spec.ts`: the discovery/detail path in an emulated 390px touch viewport, including horizontal overflow checking.
- `tests/services/access.test.ts`: complete access-report coverage, matching endpoints/revisions, and rejection of contradictory or incomplete source-only labels.
- `tests/e2e/access.spec.ts`: source-only datasets remain discoverable and link to publishers without metadata or record requests.

`tests/fixtures.ts` provides a small synthetic catalog and ArcGIS records; new unit tests should use it instead of relying on current government records. The original catalog smoke test intentionally checks the committed 52-entry/six-publisher snapshot. Review those assertions when accepting a new catalog generation.

## Isolation and reports

Unit setup rejects unmocked fetch calls. Tests stub every HTTP response they need; no routine test needs a publisher to be online. New browser scenarios use `installApi()` from `tests/e2e/helpers.ts`, which intercepts synthetic metadata/query endpoints, supplies a local tile image, and blocks other external requests. The original committed-catalog browser smoke test mocks the selected FeatureServer and blocks basemap requests. Live production checks remain the separate, opt-in `scripts/live-smoke.mjs` maintenance command.

Coverage is for `src/services/` and `src/types/` only; it is not a measurement of React components, CSS, or deployment workflows. UI behavior is exercised by browser tests. Enforced minimums: 85% lines/statements/functions and 80% branches. The HTML report is `coverage/index.html`, with machine-readable results in `coverage/coverage-summary.json`. Reports are ignored by Git.

Playwright saves HTML results and retains screenshots/traces on failures. CI runs the same checks and uploads coverage, the browser report, and test results even when a step fails. Tests run only in Chromium; Firefox, Safari/WebKit, full accessibility audits, load testing, and all-publisher live compatibility are outside this suite.

## Regression fixes verified by the suite

The expanded suite first reproduced these application bugs, then verified their fixes:

1. Negative numeric CSV values were prefixed with an apostrophe. Formula neutralization now applies to strings, preserving actual numbers.
2. Pagination advanced by the requested limit, skipping records when a publisher returned a short page with more results. It now advances by the returned count and stores visited offsets for backward navigation.
3. Download filenames used the starting row offset as the page number. They now use the page's position in navigation history.
4. Failed page requests hid the Previous control. Pagination controls remain available to recover.
5. Rejected map-area requests hid Clear Area. The active filter remains clearable after errors.
6. The keyboard skip link changed a detail route to the homepage. It now moves focus to the current main content without changing the dataset URL.

The latest bug-fix regression cases cover repeated-page rejection across retries and subsequent recovery, equivalent numeric/string record IDs, per-feature projected or malformed CRS declarations, malformed shape structures, and invalid upstream schema-file shapes/keys/fields. Generator failure tests verify that the previous catalog is retained.

The source-only panel tests also cover recovered sources, denied access, a one-record recheck limit, empty datasets, cancellation on navigation, clipboard-permission fallback, and non-overlapping controls at mobile widths. Unit tests distinguish restricted services, local offline status, server errors, timeouts, and ambiguous browser failures. Core-service/schema coverage remains enforced by CI. These results describe the checked source; they do not replace live publisher compatibility checks.

The suite contains 256 unit/integration tests and 30 desktop/mobile browser tests. Service/schema coverage remains above 98% lines. New suites cover ArcGIS discovery paging and caps, direct layer items, public organization/prefix restrictions, metadata changes and failures, curated deduplication, source/verification timestamp separation, CKAN/Socrata/file adapters, bounded file parsing, discovery fallback, typed record filters, and proxy SSRF/redirect/response-limit controls. Browser tests verify newly discovered layers, source filtering, graceful index outages, and CORS proxy fallback. Server handlers are exercised directly in unit tests, and Wrangler Pages runtime compilation/live checks supplement the mocked suite.

`tests/services/r-code.test.ts` checks all 52 actual checked descriptors, real discovered FeatureServer/MapServer layers and nonspatial tables, package ID versus website ID selection, spatial/full examples, invalid URLs/layer IDs, unsupported source types, forged metadata, and R string escaping. `tests/e2e/use-in-r.spec.ts` verifies clipboard success and selection fallback, full-retrieval warnings, spatial options, keyboard tab navigation, mobile overflow, preserved preview access, and source-only/unsupported datasets. These tests generate code from real metadata while mocking HTTP; they do not execute downloads in R. The documented function signatures and installation instructions were verified against the live pkgdown references before implementation.

ESLint also enforces a maximum cyclomatic complexity of 15 for each source function. This counts independent control-flow paths; it helps prevent request, navigation, and rendering logic from accumulating in one function. Tests are excluded from this complexity limit.
