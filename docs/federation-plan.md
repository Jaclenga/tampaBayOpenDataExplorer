# Federated discovery upgrade

## Phase 1 audit

Baseline commit: `4b7284b`. Production uses Cloudflare Pages with a static React/Vite frontend. GitHub CI is green. `public/catalog.json` contains 52 checked R-package dataset descriptors, not records. `public/access.json` is a dated browser-access audit. `getMetadata` and `getPage` already fetch original ArcGIS endpoints live, with cancellation, timeouts, bounded pages, geometry checks, and page-only exports. The main missing features are independent discovery, server-side record filters, separate source/verification timestamps, an adapter boundary, and a secure CORS fallback. Twenty Tampa layers have demonstrated browser access failures. Clearwater critical assets requires a publisher token and must remain restricted.

## Smallest safe architecture

1. Preserve the curated snapshot, stable IDs, hash routes, existing UI and tests. Add optional provenance/freshness fields without changing historical verification dates.
2. Put the existing ArcGIS implementation behind a source-adapter interface. Keep metadata and records live. Compile typed field filters; preserve stable, validated pagination and bounded exports.
3. Register the six publishers independently under `config/`. A reusable discovery module searches public ArcGIS portal items, expands FeatureServer/MapServer layers and tables, inspects metadata, and deduplicates by canonical source endpoint. A separate generated discovery index merges with the curated catalog at read time, preferring curated identities.
4. Run bounded metadata discovery daily in GitHub Actions. Save per-portal progress, errors, truncation, and timestamps. Preserve previous descriptors when a scan fails or is capped. Commit only the generated index after validation and all application checks pass. A fixed-URL Pages Function reads the public GitHub artifact with a five-minute cache, so metadata publication does not require another frontend deployment or deployment secrets. Never claim a bounded or failed scan is complete.
5. Add a same-origin Pages Function (Cloudflare Worker runtime) solely for demonstrated CORS failures. Resolve dataset IDs against committed registries. Never accept a URL, credentials, arbitrary operations, redirects, or unbounded queries. Restrict approved HTTPS origins and paths, response size, request time, and record counts. No database or bulk replication.
6. Add functional CKAN, Socrata, and bounded CSV/JSON adapters through the same interface. Only registered sources are discoverable; unsupported sources remain explicitly unavailable.

## Verification and rollout

Use mocked services in ordinary CI. Add targeted tests for discovery pagination/caps/failures, metadata normalization, deduplication, typed filters, adapter selection, source freshness, and proxy SSRF/limit controls. Exercise real registered portals in explicit maintenance checks. Deploy only after unit, security, browser, and build checks pass. Source modification times and application verification times always retain separate labels and meanings.

The scheduled index is a metadata catalog, not a government record mirror. Portal scans run through explicit maintenance commands and the schedule, with bounded requests and exposed incomplete/error status. Full inventory coverage is never implied by a limited scan.
