# Metadata categories

The catalog uses deterministic TypeScript keyword and exact-phrase matching during generation, never during page rendering. No network calls, models, new dependencies or paid services are involved. The existing thirteen curated categories remain unchanged; Health, Demographics and Government fill gaps. Uncategorized is an explicit abstention.

## Configuration and priority

- `config/categories.json`: versioned dictionaries, aliases, stopwords, weights, caps and score thresholds.
- `config/category-overrides.json`: stable dataset ID to canonical category. An explicit Uncategorized override is allowed.
- Priority: explicit override, existing curated category, recognized publisher category, previously trusted assignment, NLP, Uncategorized. Previous automatic predictions are recomputed when metadata changes. Removing an override intentionally returns that dataset to normal classification.
- `public/catalog.json` and the CRAN package list are never modified by categorization. Checked categories and explicit overrides are delivered in discovery's curatedUpdates.

Existing canonical names and publisher aliases are normalized. Unrecognized source categories remain in source_category as evidence rather than creating extra filter values. The manual overrides currently correct two reviewed records: Median_Age_of_Housing_(Years) concerns housing stock, and ParcelEvacuation concerns evacuation rather than parcel development. Their stable IDs are taken from the actual discovered catalog.

Title keywords score 8, title phrases 12, capped at 24. Tags score 3 per concept (cap 6), source categories 2 (cap 4), descriptions and field names 1 (cap 2 each). All context combined is capped at 6. Repeated words do not add scores; phrase components are not counted again as keywords in that field. Normalization handles punctuation, HTML, CamelCase, accents and simple plurals. Generic city/county/data words cannot determine categories. Planning requires a title signal because several actual services repeat land-use boilerplate across unrelated layers. Lake alone is excluded because it often appears in place names.

A winner needs score >=6 and a margin >=2. A high tier requires score >=12 and margin >=4; other accepted predictions are medium. Insufficient or tied evidence yields Uncategorized with a low tier. Tiers are rule-strength labels, **not calibrated probabilities**. Trusted assignments use high to reflect their authoritative source. A generic publisher Uncategorized value does not prevent classification.

Provenance fields: category_source, category_confidence, category_version, category_signals, category_review, source_category. Details are available in catalog JSON, review reports and the expanded dataset details. Collapsed rows and existing category filters use the ordinary category field; no AI badge is added.

## Run and review

```sh
npm run catalog:categorize
npm run category:evaluate
npm run category:evaluate -- --check
npm run discovery:refresh
```

The offline categorization command updates existing metadata without contacting publishers or changing source verification timestamps. It writes only if classifications change. The scheduled daily refresh runs the same classifier after discovery and before endpoint/catalog validation and publication. Categories come only from validated configuration; invalid overrides stop publication. Source verification failures continue retaining previous datasets.

`reports/category-review.json` contains totals, assignment sources, distribution counts, ambiguous/insufficient records with their leading candidates and signals, and changed categories. Empty categories and categories exceeding 40% are flagged for review, not automatically rebalanced. Each scheduled attempt uploads `.wrangler/category-review.json` and includes counts in its Actions summary. The committed report describes the last published classification changes; the per-attempt artifact includes attempts with no catalog changes.

## Evaluation and limitations

`tests/fixtures/category-evaluation.json` snapshots 71 actual records: all 52 checked entries with existing curated labels, plus 19 manually reviewed discovered examples, including difficult and generic titles. Evaluation withholds source categories and bypasses overrides/curated priority to assess NLP alone. This is a **small development set**, used to inspect rules, not an independent holdout or estimate of accuracy across all publishers. Health and Government have unit-test coverage but no labeled real examples in this set.

The measured result and every confusion case are in `reports/category-evaluation.json`. The remaining difficult cases are housing-stock age versus population age, and parcel evacuation's competing hazard/development evidence. Explicit reviewed overrides correct those two records in the published catalog without hiding them from the NLP evaluation. Broad or missing metadata still leaves many catalog records Uncategorized by design. Add reviewed examples before changing rules; increase category_version when dictionary behavior changes and rerun categorization and evaluation.

The evaluator also times 10,000 real metadata predictions and prints the measurement; timing is omitted from the committed report to avoid machine-specific diffs. On the development machine this took about 3 seconds. CI checks the deterministic evaluation report for drift. Unit tests cover every category, precedence, aliases, normalization, abstention, shared boilerplate, metadata updates, determinism and real catalog integration.
