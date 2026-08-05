# Michigan House Democratic primary results receipt

Status: **proposed reviewer-only factual package; not approved, published, or evaluator-eligible**

Source cutoff: **2026-08-05**

## Retained scope

The receipt retains the Democratic U.S. House result block for all 13 Michigan congressional districts in both the August 2, 2022 and August 6, 2024 state primaries. The Michigan Voter Information Center labels both statewide pages `OFFICIAL`, reports 83 of 83 counties, and is indexed by the Secretary of State's official election-results catalog.

Artifact: `data/metadata/michigan-house-democratic-primary-results-2022-2026-v1.json`

- 26 district-cycle result rows: 13 in 2022 and 13 in 2024
- 54 named candidate rows with 1,769,732 votes
- two separately retained 2024 aggregate `WRITE-IN` channels with 572 votes
- 1,770,304 total Democratic primary votes
- zero numeric evaluator values and zero score-eligible contests

The official result page does not expose a winner marker in the retained browser projection. All 26 contests therefore remain `sourceWinnerStatus: not_marked_by_source`; the package does not infer a winner by sorting vote totals. The 2022 district 4 row is a named `DEMOCRATIC WRITE-IN` candidate and remains a named candidate. The generic 2024 district 10 and district 12 `WRITE-IN` rows remain aggregate channels rather than fabricated candidate identities.

## Certification evidence

The retained August 19, 2022 Secretary of State announcement says the bipartisan Board of State Canvassers unanimously certified the August primary and that all 83 county boards had also certified their jurisdictional primaries.

The retained signed August 26, 2024 Board minutes say that, after examining the returns, the Board certified the attached report as a true statement of votes and certified the listed nominees. This supports event-level state certification; it does not create candidate identity, ideology, incumbency, geography, or evaluator determinations.

## Browser-rendered source boundary

Michigan's MVIC download route returned a Cloudflare challenge to unattended clients. The retained result sources are therefore deterministic JSON projections of the complete browser-rendered statewide result page, explicitly labeled `browser_rendered_source`, rather than raw download payloads. Each projection preserves source URL, official status, update time, county completeness, contest titles, party labels, candidate labels, vote totals, percentages, and party totals. Import requires the exact byte size and SHA-256 of the browser capture bundle.

## 2026 cutoff

The August 5, 2026 MVIC observation was `UNOFFICIAL`, updated at 1:47:07 PM, and reported only 82 of 83 counties. It exposed 12 House contests and 26 candidate rows, but the retained boundary record deliberately contains zero result rows. Michigan's election calendar places the county-canvass completion deadline on August 18 and the state-canvass meeting deadline on August 24. The package therefore records `unofficial_results_not_retained_pending_county_and_state_canvass`; a later certified result must be acquired as a separately versioned package.

## Lifecycle boundary

This source lock proves exact retained inputs and a reproducible proposed package. It is not reviewer approval or publication. Every contest remains identity- and geography-unreviewed, unselected, evaluator-null, score-ineligible, reviewer-only, and publication-ineligible.

## Reproduction and validation

```sh
MI_PRIMARY_IMPORT_DIR=/path/to/exact-capture-bundle npm run import:mi-house-primary-results
npm run generate:mi-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/michigan-house-democratic-primary-results-receipt.test.ts
npm run data:verify
npm run typecheck
```

Package SHA-256: `6572ccc3e4a9e40e36efaa33e02347330687fd8886b62887b9d095723b1492c3`

Contest-set SHA-256: `7ea71a3fa253949ad111d8eea53d9c4986cc5a5ead2d42222243b27e98240f25`
