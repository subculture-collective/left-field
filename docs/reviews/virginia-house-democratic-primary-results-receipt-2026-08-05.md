# Virginia House Democratic primary results receipt

Date: 2026-08-05
Status: proposed reviewer-only evidence; not approved, selected, score-bearing, or published

## Result

The receipt retains twelve reported Democratic U.S. House primary contests from exact Virginia Department of Elections result payloads:

- 2022: one official, event-certified contest in district 8; two candidates; 50,645 votes.
- 2024: six official, event-certified contests in districts 1, 2, 5, 7, 10, and 11; 28 candidates; 199,985 votes.
- 2026: five explicitly unofficial August 5 snapshots in districts 1, 2, 5, 8, and 9; 22 candidates; 201,765 votes.

All 452,395 candidate votes reconcile exactly to the source contest totals. Districts absent from a result response are not represented as zero, no-candidate, uncontested, or no-primary dispositions.

Artifact: `data/metadata/virginia-house-democratic-primary-results-2022-2026-v1.json`
Artifact SHA-256: `85858953a6b8478e3a738e3427fb160e2428efc3805de377192bdc8e75433e47`
Package SHA-256: `0048f27a17220816e7aeaf0f8abcd4760608cfbf889bcac681b7f2cbb60b300d`
Contest-set SHA-256: `6e9d5e82b2439029333b8b5f3188324f0e6e57946f5e88d2d176cfa5cebf43dd`

## Official historical boundary

The State Board annual reports say the Board certified the June 21, 2022 and June 18, 2024 U.S. House primary events and declared winners nominees. Those reports establish event-level certification. They are not individual signed per-contest certificates or detailed candidate-vote tabulations, so the receipt retains that distinction explicitly.

The 2022 result JSON contains only district 8. The 2024 official API has `isOfficialResults: true` and exactly six House ballot items. Source winner markers are retained for 2024 but do not establish a current-incumbent identity or reviewer selection.

## August 5, 2026 boundary

Virginia's official result metadata has `isOfficialResults: false`, an embedded `asOf` of `2026-08-05T16:54:16.700627Z`, and five returned House contests. Every candidate sum equals the corresponding source total, but reporting-unit completion is not certification or immutable finality. Mailed, provisional, post-election, and State Board certification processes remained open.

The exact metadata and ballot-item bytes are retained as time-stamped `source_snapshot` inputs. The fetch command requires those exact imported snapshots instead of silently replacing them from the evolving live endpoint. A future certified result must be acquired into a separately versioned artifact.

The 2026 snapshot creates no certified nominee, current-incumbent identity, disposition for an absent district, progressive classification, selection, evaluator value, score, reviewer decision, or publication state.

## Lifecycle

All twelve contests remain current-identity and historical-geography unreviewed, unselected, score-ineligible, evaluator-null, reviewer-only, and publication-ineligible. The receipt inherits two unresolved parent decisions and resolves neither:

- official state primary result and certification collection; and
- treatment of nonstandard or absent primary dispositions.

## Reproduction

```bash
VA_PRIMARY_SNAPSHOT_IMPORT_DIR=/path/to/exact-20260805-snapshots npm run fetch:va-house-primary-results
npm run generate:va-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/virginia-house-democratic-primary-results-receipt.test.ts
npm run data:verify
```
