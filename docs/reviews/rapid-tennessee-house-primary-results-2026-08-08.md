# Tennessee rapid House-primary results receipt — 2026-08-08

This reviewer-only rapid slice retains the Tennessee Secretary of State precinct workbooks for the completed 2022 and 2024 primaries and projects only target district TN-09. It is not an approval or an active Priority Index input.

## Retained authority

- 2022 workbook: 5,883,199 bytes; SHA-256 `e48044d15f8bac515280dae069ef0e7468a07424df6826cd5d62985c312f9849`.
- 2024 workbook: 1,613,430 bytes; SHA-256 `3e3589f37aa7680894e711151905dcdbb121b16d32c37414f6e28ddd42090e65`.

Each workbook is parsed from the exact `United States House of Representatives District 9` / `Democratic Primary` rows. Both contain 125 precinct rows spanning Shelby and Tipton counties. The 2022 candidate/write-in totals are M. Latroy Alexandria-Williams 8,449; Steve Cohen 62,055; and Ollie O. Nelson write-in 2 (70,506 total). The 2024 totals are M Latroy A-Williams 1,936; Steve Cohen 30,042; Kasandra L Smith 1,523; and Corey Strong 7,258 (40,759 total).

The source does not mark a winner and no separate certification instrument is retained. Candidate identity, winner identity, approval, and score eligibility stay null or false. The 2026 federal primary remains source-blocked because the official results page currently exposes only the May judicial primary, not an August federal-primary result file.

## Reproduction

```text
npm run acquire:rapid-house-primary-tennessee
npm run generate:rapid-house-primary-tennessee-results
npm run generate:rapid-house-primary-projection-v10
npx vitest run src/rapid-acquisition/house-primary-tennessee-results.test.ts src/rapid-acquisition/house-primary-projection-v10.test.ts src/ui/rapid-house-primary-coverage.test.ts
```
