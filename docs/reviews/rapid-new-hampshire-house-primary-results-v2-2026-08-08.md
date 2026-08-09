# Rapid New Hampshire House primary results v2

The v2 rapid receipt adds both 2022 Democratic congressional workbooks to the existing 2024 New Hampshire package. These are deterministic Internet Archive captures of the exact New Hampshire Secretary of State file URLs because the current official host returns HTTP 403 to automated retrieval.

The parser validates each XLSX container, exact sheet/title/date/header layout, literal town-level vote cells, formula-bearing cached totals, and exact arithmetic closure. NH-01 contains Chris Pappas 41,990 across 109 reporting-unit rows. NH-02 contains Ann McLane Kuster 48,630 across 211 rows. Together with 2024, the package closes four contests, six candidate rows, and 215,632 candidate votes.

Retained 2022 sources:

- NH-01 workbook: 18,779 bytes; SHA-256 `251da7809640050d0b5140b39ba2ec0f6e32aeea1bed4f90db89789f270eba25`.
- NH-02 workbook: 22,696 bytes; SHA-256 `856b0e14aacb6455772cb7e4cb24af33dd2bb5c1357a37e8a04b16e60811da1f`.

The workbooks do not mark winners and are not treated as separate certification instruments. Candidate identity, winner identity, publication approval, and score eligibility remain null or false. The active Priority Index is unchanged.

Reproduction:

```sh
npm run acquire:rapid-house-primary-new-hampshire-2022
npm run generate:rapid-house-primary-new-hampshire-results-v2
npm run generate:rapid-house-primary-projection-v15
```
