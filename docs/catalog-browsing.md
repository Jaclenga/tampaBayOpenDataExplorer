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
