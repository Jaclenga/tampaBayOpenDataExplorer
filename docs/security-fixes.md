# Security and reliability fixes

The reported functional and security issues are covered by focused regressions in `tests/services/reported-regressions.test.ts`, `tests/services/request-budget.test.ts` and the workerd runtime check `scripts/test-proxy-guard.mjs`.

| Issue | Result |
| --- | --- |
| Moved services duplicate stable discovery IDs | Current descriptors replace matching IDs before endpoint deduplication; a moved endpoint no longer invalidates the complete index. |
| ArcGIS path casing creates duplicates and exclusions | The fixed `/arcgis/rest/services` prefix is normalized, including organization-prefixed ArcGIS Online paths. Service-name casing is preserved. Allowlist comparisons enforce path boundaries. |
| Old discovery timestamps override fresh curated checks | The newest successful endpoint inspection supplies the verification/source-update timestamp pair. Curated IDs and provenance remain intact. |
| Known proxy IDs use stale bundled endpoints | ArcGIS IDs are resolved against the latest validated index with refreshed descriptors taking precedence. |
| CKAN accepts repeated or contradictory pages | Missing/duplicate/previous IDs and empty pages claiming further results fail explicitly. |
| CSV discards empty-valued records | Only physically blank lines are ignored; quoted empty records and delimiter-only rows remain records. |
| Discovery follows off-allowlist redirects | Shared JSON and file transports use manual redirect handling and reject 3xx/opaque redirects without following them. |
| Direct JSON responses have no byte cap | Shared JSON transport cancels streams over 2 MiB before JSON parsing. Small-file previews retain their 1 MiB cap. |
| Proxy abuse and expensive work before validation | Request shape/origin checks run before index loading or admission; a private Durable Object coordinates shared rate and concurrency limits. |

## Proxy budgets and privacy

`config/proxy-budget.json` sets a fixed one-minute window: 60 admissions per client, 120 across the application, and eight simultaneous requests. Counts include valid-looking requests for unknown ArcGIS IDs so catalog resolution cannot bypass the budget. Fixed windows permit boundary bursts; concurrent publisher/index work remains capped at eight. The client key is a SHA-256 hash of Cloudflare's trusted `CF-Connecting-IP` header. Shared-IP users share the allowance; no accounts or user tracking tokens are introduced.

`tampabay-explorer-proxy-guard` is a separate private Worker exporting a SQLite-backed `ProxyGuard` Durable Object. Its public workers.dev route and preview URLs are disabled. The Pages namespace binding routes every proxy admission through the same named object. Storage transactions coordinate concurrent callers across isolates/locations. Only counters, hashed client keys and lease IDs are stored. Leases expire after 30 seconds, and an alarm clears stored state after 90 seconds of inactivity. No source records or raw IP addresses are stored.

Every admitted request releases its lease in `finally`, including publisher/index failures. Abandoned leases expire. HTTP 429 includes `Retry-After`; a missing/unavailable gate or trusted client header returns HTTP 503 and does not contact the publisher. This bounds publisher work; it is not a claim to prevent all edge-level DDoS or provider-quota exhaustion. Cloudflare's free-tier operation limits still apply.

## Build, deployment and verification

`npm run typecheck` and `npm run build` generate `worker-configuration.d.ts` from the Pages Wrangler configuration. The generated file is ignored by Git. `npm run test:guard` uses the exact Miniflare version already required by the installed Wrangler, declared as a direct development dependency, to exercise the real workerd/SQLite implementation with concurrent stubs and client quotas. It makes no publisher requests. `npm run test:all` includes this runtime test alongside the existing unit and browser suite.

Deploy the private Worker before Pages:

```sh
npm run deploy:guard
npx wrangler pages deploy dist --project-name=tampabay-open-data-explorer
```

`npm run deploy` builds and deploys both in this order. Automated code deployment needs Pages Edit and Workers Scripts Edit permissions. Daily metadata publication still needs only the GitHub token. To reproduce the Pages-to-guard binding locally, run `npx wrangler dev --config wrangler.guard.jsonc --port 8789` and `npx wrangler pages dev dist --port 8788` in separate terminals.

Cloudflare references: [Pages Durable Object bindings](https://developers.cloudflare.com/pages/functions/bindings/#durable-objects), [Durable Objects pricing/free-tier availability](https://developers.cloudflare.com/durable-objects/platform/pricing/), and [strict shared limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/#strict-limits).
