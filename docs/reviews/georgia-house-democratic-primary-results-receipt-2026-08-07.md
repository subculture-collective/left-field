# Georgia Democratic U.S. House regular-primary results receipt — 2026-08-07

## Outcome

The repository now retains Georgia Secretary of State production-result metadata and the complete statewide `Total Votes` workbooks for the May 24, 2022, May 21, 2024, and May 19, 2026 regular primaries. The deterministic reviewer-only receipt contains all 42 Democratic U.S. House district-cycle contests, 103 candidate rows, and 2,230,328 exactly reconciled votes.

The artifact also exposes 12 bounded current-target observations for GA-02, GA-04, GA-05, and GA-06 across the three cycles. Those target contests contain 22 candidate rows and 965,634 votes. For current GA-06 in 2022, the observation deliberately binds Lucy McBath's source contest in GA-07. It does not substitute the unrelated source GA-06 contest and does not claim that the historical and current districts are geographically compatible.

The package is proposed, reviewer-only, score-ineligible, publication-ineligible, and undeployed. It resolves no decision and creates no winner, nominee, runoff-advancement, identity, geography, progressive-classification, or evaluator conclusion.

## Official-source boundary

Each retained election-metadata response has `isOfficialResults: true` and `isProduction: true`. The result workbooks are bound to those metadata records through the source lock. No separate signed statewide certification instrument was retained and bound to these exact workbook bytes, so every contest uses:

- result authority: `secretary_official_results_workbook_retained`;
- certification: `official_results_flag_retained_no_separate_signed_certificate`;
- source winner: `not_marked_by_source`;
- winner, nomination, and runoff-advancement conclusions: null.

Only the regular-primary workbooks are in scope. Georgia publishes runoff results as separate election events; they are not retained or assessed here. Vote rank, a one-candidate contest, and the source `(I)` label do not become lifecycle or identity evidence.

## Corpus closure

| Cycle | Workbook rows | Workbook candidates | Workbook totals | All-workbook reconciled votes | Democratic House contests | Democratic House candidates | Democratic House votes |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2022 | 1,318 | 803 | 515 | 53,452,014 | 14 | 31 | 685,661 |
| 2024 | 1,350 | 763 | 587 | 29,814,017 | 14 | 30 | 526,974 |
| 2026 | 1,383 | 829 | 554 | 54,540,979 | 14 | 42 | 1,017,693 |
| Total | 4,051 | 2,395 | 1,656 | 137,807,010 | 42 | 103 | 2,230,328 |

The parser reads XLSX ZIP/XML directly and resolves only the sheet named exactly `Total Votes`. It validates the A–F header, every source row, all candidate/total reconciliations, all 14 district keys per cycle, the mixed 2022 office-title forms, the 2024 district-12 spacing variant, and the nonnumeric 2026 `USHnD` contest IDs. `Total Votes by Group`, precinct, and county sheets are not counted again.

## Provenance and topology

The output source-lock entry has exactly four ordered direct parents:

1. `house-democratic-primary-source-selection-proposal-20260804-v1`
2. `ga-2022-general-primary-total-votes-workbook`
3. `ga-2024-general-primary-total-votes-workbook`
4. `ga-2026-general-primary-total-votes-workbook`

Each workbook directly parents its corresponding retained election-metadata response. The receipt itself lists all six retained Georgia inputs while avoiding redundant direct output-parent edges.

Canonical artifact:

- path: `data/metadata/georgia-house-democratic-primary-results-2022-2026-v1.json`
- bytes: `101663`
- file SHA-256: `cbf01649db31686e053544e2d616a1a52055117ee3f2747e8fed530266eb9308`
- package SHA-256: `0048130e863daae9d527528a1a004b73e811ff27ad1fac1d4d98ca13937944ee`
- contest-set SHA-256: `63233fddde9cf2a21543e7eb40ff182ed66d5a6b138108dcc43ad4577a74e82e`
- target-observation-set SHA-256: `37413c20ce73f52e08990c321f397b15a788211aca8d6a18f5a2ec5c82881d06`

## Reproduction and validation

```bash
npm run fetch:ga-house-primary-results
npm run generate:ga-house-primary-results-receipt
npx vitest run src/ingestion/elections/georgia-house-democratic-primary-results-receipt.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The fetcher and generator are create-only/idempotent: existing equal bytes are accepted, while conflicting bytes fail closed. Tests cover exact corpus and target closure, the 2022 GA-07/current-GA-06 boundary, official-source semantics, source byte drift, output-parent reordering, and fully rehashed winner, scoring, and geography escalation.

## Remaining gates

- review current-incumbent candidate identity;
- acquire/review Georgia's CD118-to-CD119 redraw mapping and keep 2026/CD120 separate;
- review the regular-primary/runoff disposition without inferring advancement;
- review progressive classification;
- complete human review and explicit publication approval.
