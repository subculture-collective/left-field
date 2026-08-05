# Florida House Democratic primary results receipt

Status: **proposed reviewer-only factual package; not approved, published, or evaluator-eligible**

Source cutoff: **2026-08-05**

## Retained scope

The receipt retains every Democratic U.S. House contest returned by the Florida Division of Elections statewide database extract with `OfficialResults=Y` for the August 23, 2022 and August 20, 2024 primary elections.

Artifact: `data/metadata/florida-house-democratic-primary-results-2022-2026-v1.json`

- 23 reported district-cycle contests: 14 in 2022 and 9 in 2024
- 70 named candidate rows with 1,102,941 votes
- all returned county rows report equal precinct and precinct-reporting counts
- 33 district-cycle blocks absent from the official extract remain unresolved
- zero numeric evaluator values and zero score-eligible contests

The retained extract exposes no source winner marker. All 23 contests therefore remain `sourceWinnerStatus: not_marked_by_source`; the package does not infer a winner by sorting vote totals. A missing district does not become a zero, uncontested nomination, no-candidate disposition, or proof that no primary occurred.

## Official-results and certification boundary

The exact retained download forms select `OfficialResults=Y`, and the complete returned statewide extracts are retained byte-for-byte. The package labels these rows `division_official_results_extract_retained` and reconciles every candidate total from the returned county rows.

No separately posted signed certificate tied to these exact extract bytes was found or retained in the bounded source review. The narrower status is therefore `official_results_flag_retained_no_separate_signed_certificate`. Calendars and meeting schedules are not substituted for a signed certification instrument.

The Division also publishes precinct-level ZIP files and 2022 congressional recount material. Those files are not overlaid in v1 because the CD4 recount-file overlay and the separate CD7 precinct-ZIP baseline did not reconcile to the Division statewide official extract. Those discrepancies are preserved as a separate unresolved reconciliation gate rather than silently changing the statewide totals.

## 2026 cutoff

Florida's official election-dates page schedules the 2026 primary for August 18, after this package's August 5 cutoff. The official reporting timeline schedules Elections Canvassing Commission certification for August 27. The package therefore records `unofficial_results_not_retained_election_not_yet_held_at_cutoff` and retains zero 2026 result rows, candidate rows, dispositions, evaluator values, or scores.

## Lifecycle boundary

This source lock proves exact retained inputs and a reproducible proposed package. It is not reviewer approval or publication. Every contest remains identity- and geography-unreviewed, unselected, evaluator-null, score-ineligible, reviewer-only, and publication-ineligible. The receipt supports the two existing primary-source and nonstandard-disposition decisions but creates no new decision and resolves neither one.

## Reproduction and validation

```sh
FL_PRIMARY_IMPORT_DIR=/path/to/exact-download-bundle npm run import:fl-house-primary-results
npm run generate:fl-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/florida-house-democratic-primary-results-receipt.test.ts
npm run data:verify
npm run typecheck
```

Package SHA-256: `1240cd10778f3bf37acce392353b0dcc0d2deaad18b3cad5b753284cc874a2e8`

Contest-set SHA-256: `c866bf532a678bfe92c72b734386b2ae9318589e690ee96f0e4f1180e6a1df40`
