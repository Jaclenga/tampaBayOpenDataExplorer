# Catalog browsing

The catalog uses compact rows with inline details. Desktop filters stay at the top of the viewport while scrolling; mobile filters open in a collapsible panel. Search runs locally across titles, descriptions, publishers, categories, tags, catalog IDs, and package IDs. Search and all four filters intersect.

Name sorting is alphabetical by default. Publisher and category sorting use name as a tie-breaker. Recent verification sorting uses the last successful endpoint check, falling back to the package check date; missing or invalid dates sort last. Verification is a structural check, not a publisher record-update time.

## Shared views and navigation

URL query parameters preserve the search (`q`), publisher, category, data type (`type`), platform, sort order (`sort`), and number of visible rows (`shown`). The hash still selects a dataset or page section. Opening a dataset and returning preserves loaded rows, filters, sort order, expanded rows, and scroll position during that visit. Reloading a shared URL restores filters, sort order, and loaded-row count; inline expansions and scroll position are session-only.

The first 100 matches are rendered. **Show more datasets** adds another 100; search and sort changes reset this count. This is catalog navigation, separate from live record pagination inside a dataset.

## Inline details and R examples

Details include full descriptions, identifiers, source links, available schema and provenance, separate publisher-update and verification timestamps, and the existing **Use in R** component. Checked datasets use an exact catalog-supported package ID; registered public ArcGIS discoveries use the original layer URL. Unsupported sources show an explanation without a retrieval command. Clipboard failures leave selectable code.

## Verification

`tests/e2e/catalog-browsing.spec.ts` covers keyboard expansion, combined filters/search, browser Back, shared URL reloads, load-more/scroll restoration, desktop sticky filters, real package R commands and clipboard feedback, mobile details, and real discovery titles. Existing preview/map/export tests remain in the browser suite. Search and sorting regressions are in `tests/services/catalog.test.ts`.

At a 1440 x 1000 viewport, a ten-row real-catalog sample changed from 192-215 px per row (197 px average) to 95 px per collapsed row. This gives about twice the browsing density. Long titles, unavailable-source notices, and mobile metadata may need more space. Expanded rows intentionally grow to show their contents.
