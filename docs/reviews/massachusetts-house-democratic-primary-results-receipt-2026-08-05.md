# Massachusetts House Democratic primary results receipt

Date: 2026-08-05
Status: proposed reviewer-only evidence; not approved, selected, score-bearing, or published

## Result

The receipt retains the Massachusetts Secretary of the Commonwealth Elections Division's complete PD43+ Democratic U.S. House primary search enumerations for September 6, 2022 and September 3, 2024, plus all 18 district-level municipality CSVs. Each cycle contains exactly districts 1–9.

- 18 reported historical contests;
- 18 named source candidate rows;
- 2,464,888 named-candidate votes;
- 18,728 `All Others` votes;
- 310,514 blank votes; and
- 2,794,130 total votes cast, reconciled exactly from every municipality row.

One printed candidate plus `All Others` is retained as a reported single-named-candidate contest. It is not inferred to mean uncontested.

Artifact: `data/metadata/massachusetts-house-democratic-primary-results-2022-2026-v1.json`
Artifact SHA-256: `8dbcf792852355bcb88618a9982d22d422e5dab222330d9110f4644e10ac47cb`
Package SHA-256: `eb2c8172b785bea76e9632cb6813bd53a2b2ec2ad1ebbd232482bda45df63931`
Contest-set SHA-256: `2bcd6a4082753ff34868b3523ac9ef1c5981a8de48e0f03bcb453f58277ba8f9`

## Authority and certification boundary

The official policy says Massachusetts does not publish unofficial results; it publishes final, certified official results to PD43+ after local clerks certify and submit them and the Elections Division reviews them. This supports `official_database_published_after_certification`. No individual signed or sealed certificate is retained for these district records, so the distinct certificate-instrument status remains `database_policy_bound_no_individual_signed_certificate`.

The two policy/schedule pages were retained as browser-rendered HTML because `sec.state.ma.us` returned a self-redirect loop to command-line requests. Their exact rendered bytes, sizes, hashes, page identities, and required phrases are pinned and validated. PD43+ search and CSV sources remain directly fetchable and reproducible.

## 2026 boundary

The official upcoming-election page schedules the Massachusetts state primary, including U.S. Representative, for September 1, 2026—27 days after the source cutoff. The receipt therefore contains an availability-only cycle record:

`scheduled_not_held_at_source_cutoff`

It creates zero 2026 result, disposition, candidate, vote, winner, selection, or evaluator rows. It does not treat a future event as zero, uncontested, unavailable, or a reason to select 2024.

## Lifecycle

Generation validates the exact parent source-selection proposal and fails if either inherited decision changes from `resolution: null`. This artifact creates no decision and provides evidence only to the existing nationwide collection and nonstandard-disposition decisions.

All contests remain current-identity and historical-geography unreviewed, unselected, score-ineligible, evaluator-null, and publication-ineligible.

## Reproduction

```bash
MA_PRIMARY_AUTHORITY_IMPORT_DIR=/path/to/browser-rendered-authority npm run fetch:ma-house-primary-results
npm run generate:ma-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/massachusetts-house-democratic-primary-results-receipt.test.ts
npm run data:verify
```
