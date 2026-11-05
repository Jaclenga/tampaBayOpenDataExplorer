# Catalog browsing

The catalog uses compact rows with inline details. Desktop filters stay at the top of the viewport while scrolling; mobile filters open in a collapsible panel. Search runs locally across titles, descriptions, publishers, categories, tags, catalog IDs, and package IDs. Search and all four filters intersect.

Name sorting is alphabetical by default. Publisher and category sorting use name as a tie-breaker. Recent verification sorting uses the last successful endpoint check, falling back to the package check date; missing or invalid dates sort last. Verification is a structural check, not a publisher record-update time.

## Shared views and navigation

URL query parameters preserve the search (`q`), publisher, category, data type (`type`), platform, sort order (`sort`), page (`page`), and rows per page (`pageSize`). The hash still selects a dataset or page section. Opening a dataset and returning preserves the page and page size, filters, sort order, expanded rows, and scroll position during that visit. Reloading a shared URL restores filters, sort order, and pagination; inline expansions and scroll position are session-only.

Only the current page is rendered, with 20 rows by default and choices of 10, 20, 50 or 100. Previous/Next controls appear only for multiple pages. Search, filters, sort and page-size changes reset to page 1. Invalid pagination parameters use defaults, and pages beyond the results are clamped. Obsolete `shown` parameters are removed. UI changes replace the current history entry; dataset links retain normal Back/Forward navigation. Page changes clear inline expansions and focus/scroll to the results controls using immediate motion; changing page size does not explicitly scroll. This is catalog navigation, separate from live record pagination inside a dataset.

## Inline details and R examples

Details include full descriptions, identifiers, source links, available schema and provenance, separate publisher-update and verification timestamps, and the existing **Use in R** component. Checked datasets use an exact catalog-supported package ID; registered public ArcGIS discoveries use the original layer URL. Unsupported sources show an explanation without a retrieval command. Clipboard failures leave selectable code.

## Verification

`tests/e2e/catalog-browsing.spec.ts` covers keyboard expansion, combined filters/search, browser Back, shared URL reloads, pagination/scroll restoration, desktop sticky filters, real package R commands and clipboard feedback, mobile details, and real discovery titles. Existing preview/map/export tests remain in the browser suite. Search and sorting regressions are in `tests/services/catalog.test.ts`.

Rows use a 16 px semibold title, muted publisher/category/actual geometry metadata separated by middle dots, and a description of up to two lines. Long titles wrap naturally. Source-only rows link directly to the publisher; their title still opens the dataset workspace. Known source-check failures remain visible, while ordinary preview limitations are explained neutrally inside expanded details.

Every collapsed row has a View dataset action (View source for source-only entries) and a keyboard-accessible Details button. Catalog provenance, package support, verification metadata, and R commands remain available in expanded details. Search submission keeps focus and scroll in place; search, sorting, filtering, and row disclosure do not automatically scroll the page. The result list and filters use the document scroll area. Filters collapse at tablet widths of 1000 px and below. R code retains its own bounded code-field scrolling.

`tests/e2e/catalog-scroll.spec.ts` checks 75-100 px desktop rows, seven or more fully visible rows, non-overlap, sticky sidebar/header/footer boundaries, expansion/collapse scroll stability, search/sort/filter scroll stability, and tablet/mobile layouts.


## Catalog status

The Browse datasets heading has a plain status line with "Last checked" and a full-month date, the number of datasets successfully verified, and a "Coverage details" link to the existing Catalog Status view. Status labels and attempt details appear in that secondary view. Report generation times and total retained dataset counts are never substituted for successful verification. A failed latest attempt can show zero verifications alongside an earlier successful check; the status view explains retained records separately.

`#catalog-status` is a dedicated hash-routed view that preserves query parameters and catalog browsing state. It shows verification/attempt dates, publisher and issue counts, discovery coverage, collapsed publisher summaries, grouped diagnostic messages and original technical reports. Exact messages and distinct endpoints remain available in nested technical explanations and unchanged report URLs. Discovery delivery warnings appear here instead of in a banner above the catalog. Publisher source-update times remain on dataset pages.

Presentation labels are Healthy only when successful verification is recent and configured scans have no known limitations; Partial when there are limits, failures or fallback delivery; Unavailable when successful results cannot be established; Stale when the last successful check is more than the configured threshold old. `config/catalog-status.json` sets the display threshold to 48 hours (two daily refresh intervals). This is a display policy, not a change to discovery, verification or scheduling. Historical successful counts unavailable in the report are not reconstructed. A publisher's last successful check is the latest retained endpoint-check timestamp for that portal, not its scan-finished time.

The status page links to the latest scheduled report, bundled discovery report, separate browser-access audit, and existing Actions history/artifacts. The website reflects the published snapshot; no-op attempts are available in Actions. `tests/services/catalog-status.test.ts` and `tests/e2e/catalog-status.spec.ts` cover these semantics, report links, focus, disclosure, navigation and mobile wrapping.
