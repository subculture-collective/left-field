# New Mexico Democratic U.S. House primary results receipt — 2026-08-07

## Outcome

The repository now retains the New Mexico Secretary of State federal-result CSV exports for the June 7, 2022, June 4, 2024, and June 2, 2026 primaries. The deterministic reviewer-only receipt closes all nine Democratic U.S. House district-cycle contests, ten candidate rows, and 441,199 candidate votes. Those nine contests are also the complete current-target observation matrix for NM-01, NM-02, and NM-03.

The package is proposed, reviewer-only, score-ineligible, publication-ineligible, and undeployed. It resolves no decision and creates no winner, nominee, uncontested, identity, geography, progressive-classification, or evaluator conclusion.

## Official-source boundary

The 2022 Secretary archive links event 2827 as `2022 Primary Election Official Results`; a separate signed statewide certificate is not retained. The 2024 and 2026 State Canvass Board announcements say the statewide primary results were unanimously certified, but the announcement pages are not represented as exact candidate-by-candidate signed certificate bytes.

Every contest retains `secretary_official_federal_results_export_retained`, complete precinct reporting, `sourceWinnerStatus: not_marked_by_source`, and null winner/nomination conclusions. Vote share, vote rank, and a one-candidate contest do not become winner, nominee, or uncontested evidence.

The 2026 CSV URL is the Secretary's current-event federal endpoint and has no stable event identifier in its query. Reproducibility is therefore bound to the exact retained bytes, SHA-256, August 7 cutoff, and the separately retained certification announcement—not to an assumption that the live endpoint will remain unchanged.

## Corpus closure

| Cycle | Full federal export rows | Full export races | Full export votes | Democratic House contests | Democratic House candidates | Democratic House votes |
|---|---:|---:|---:|---:|---:|---:|
| 2022 | 8 | 3 | 224,052 | 3 | 4 | 122,707 |
| 2024 | 19 | 5 | 633,776 | 3 | 3 | 122,778 |
| 2026 | 10 | 4 | 540,039 | 3 | 3 | 195,714 |
| Total | 37 | — | 1,397,867 | 9 | 10 | 441,199 |

The parser validates the exact 13-column CSV header, permits only the source's empty trailing field, validates every federal row and full-file count, requires nonnegative integers and complete precinct fractions, and reconciles absentee/election-day/early components wherever those fields are populated. Only rows whose source race is `United States Representative`, party is `DEM`, and area is district 1–3 enter the House corpus.

## Provenance and topology

The output source-lock entry has exactly four ordered direct parents:

1. `house-democratic-primary-source-selection-proposal-20260804-v1`
2. `nm-2022-primary-federal-results-csv`
3. `nm-2024-primary-federal-results-csv`
4. `nm-2026-primary-federal-results-csv`

Each CSV directly parents its cycle authority page. The receipt lists all six retained New Mexico inputs while avoiding redundant direct output-parent edges.

Canonical artifact: 31,797 bytes; file SHA-256 `d25538e1b9275553a36843b8eca6205427418f1efed3391f953ca5e85ada3882`; package `305c2d1da85cfb8e3725ef29100c825de5d50b56e4fe9513e0f6045b132ac326`; contest set `a039ee0fcf6204626f14949a739b658fec40416abe4db2e1175af80676b7c817`; target set `e63dc038166a42602828900826dd4d874c2fa0b9652703b230338be1b461d18e`.

## Reproduction and validation

```bash
npm run fetch:nm-house-primary-results
npm run generate:nm-house-primary-results-receipt
npx vitest run src/ingestion/elections/new-mexico-house-democratic-primary-results-receipt.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The fetcher and generator are create-only/idempotent. Tests cover full export and House closure, source-byte drift, exact output-parent order, canonical artifact reproduction, and fully rehashed scoring, winner, and identity-approval escalation.

## Remaining gates

- review current-incumbent candidate identity;
- review historical district compatibility, including 2026/CD120 authority separately;
- review primary disposition without inferring a winner or nomination;
- review progressive classification;
- complete human review and explicit publication approval.
