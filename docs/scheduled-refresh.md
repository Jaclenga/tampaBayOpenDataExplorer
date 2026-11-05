# Scheduled catalog refreshes

GitHub Actions runs **Refresh discovery metadata** daily at approximately **4:17 AM America/New_York** and on manual request. The workflow sets an explicit IANA timezone so the local time follows daylight saving time. GitHub may delay scheduled jobs, and public-repository schedules can be disabled after 60 days without repository activity. See [GitHub scheduling behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Your computer does not need to be running. There are no new services, credentials, dependencies, or databases.

## Manual refresh

Open [Actions: Refresh discovery metadata](https://github.com/Jaclenga/tbdataexplorer/actions/workflows/discovery.yml), choose **Run workflow**, select `main`, and run it. With the GitHub CLI:

```sh
gh workflow run discovery.yml --repo Jaclenga/tbdataexplorer --ref main
gh run list --repo Jaclenga/tbdataexplorer --workflow discovery.yml --limit 5
gh run watch RUN_ID --repo Jaclenga/tbdataexplorer --exit-status
```

Use the same workflow rather than manually committing generated metadata. Refresh jobs share a concurrency group and never run over one another. Publication is a normal fast-forward push; a concurrent unrelated push causes a safe failure instead of an overwrite. Rerun against the updated main branch.

## What is refreshed

The existing discovery adapters query the reviewed publishers in `config/portals.json`. The existing budgets remain 40 services and 150 layers per portal, with two publishers scanned concurrently and a 15-minute total scan deadline. Public metadata, identifiers, source URLs, descriptions, categories, field schemas, source update times, and endpoint capabilities are refreshed. Records are not retained.

`public/catalog.json` remains the checked R-package subset. The refresh never changes its supported dataset list or package verification dates. `public/discovery.json` holds discovered descriptors plus separate `curatedUpdates` containing live metadata for existing checked IDs. The upstream catalog verification workflow continues to require review of changes to the checked registry.

Failed, empty, or incomplete scans retain previous verified descriptors and verification timestamps. New successful inspections can still be published when another publisher fails. Unexpected empty results are flagged; a bounded scan is never presented as an exhaustive regional inventory. Duplicate fresh identifiers and invalid/unregistered endpoints prevent publication.

## Validation and publication

Candidates are validated against the catalog schema and publisher allowlist before atomic replacement. The workflow then runs type checking, lint, unit/coverage checks, production builds, guard runtime checks, and desktop/mobile browser tests. Only `public/discovery.json` is committed. The bot needs only the built-in GitHub token with `contents: write`.

The Pages site uses **direct uploads, not Git integration**. For metadata updates, its existing `/api/discovery` function reads the validated snapshot from the repository. Therefore a scheduled commit is delivered automatically without a Cloudflare token or a new static deployment. The workflow polls the public endpoint and verifies the committed generation timestamp, retained-layer count, and `X-Catalog-Index: scheduled-index` response header. It allows 12 minutes for GitHub/CDN cache propagation. Code changes still use the existing Pages deployment process; the bundled fallback index updates with those deployments.

Timestamp-only same-day reruns are recorded in Actions artifacts without unnecessary commits. Changes in data, source timestamps, endpoint health, or verification day cause a commit. A daily verification heartbeat is an intentional freshness update, even when dataset descriptions are unchanged. The website displays the most recent **published** check; the Actions artifact includes the exact latest attempt, including no-op reruns.

## Reports and troubleshooting

Every run uploads a 14-day `discovery-report` artifact, including `.wrangler/discovery-refresh.json`, the published snapshot, and test reports. The Actions summary lists each publisher, scanned/reported services, discovered layers, limits/errors, and added/updated/retained counts. Added and updated identifiers are included in the full report. The full report includes attempt start/end timestamps, successful verification counts, per-publisher errors, and separate curated endpoint failures.

- **Partial outcome:** some publishers failed or budgets were reached. Valid updates publish; old descriptors remain. Review `runs[].issues`, `nextStart`, and per-layer verification timestamps. Increase budgets only after reviewing load and runtime.
- **Failed outcome:** no endpoint verification succeeded. The validated failure snapshot preserves records, and the health step fails visibly. Retry after publisher recovery; do not delete prior descriptors.
- **Validation or duplicate-ID failure:** publication stops and the previous snapshot remains intact. Inspect the refresh/validation step and the candidate artifact when available.
- **Unexpected empty response:** treated as a publisher/schema issue when that publisher previously had datasets. Old entries remain; review the publisher service before retiring records.
- **Publication verification failure:** first inspect the Git push step, then `/api/discovery`. `X-Catalog-Index: bundled-fallback` means the live GitHub artifact could not be retrieved or validated. Review the fixed repository URL, schema, publisher allowlist, and response limits. A committed catalog is preserved even if the delivery check times out.
- **Permission/push failure:** check Actions repository contents-write permission and branch protections. A bot commit using the built-in token does not trigger another ordinary push workflow; all required tests run inside the refresh job before its commit.
- **No scheduled run:** confirm the workflow is enabled on the default branch and has not been disabled for repository inactivity. Trigger it manually to diagnose runner or publisher failures.

The compact website indicator separates published verification from incomplete discovery. Publisher source-update timestamps remain separate from verification timestamps. `lastSuccessfulRunAt` records the last refresh with at least one successful endpoint verification; it is not evidence that every portal was scanned or every dataset was verified.
