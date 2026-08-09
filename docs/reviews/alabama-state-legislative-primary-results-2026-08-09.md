# Alabama state-legislative primary context — 2026-08-09

The rapid local-context lane now retains the candidate-bearing Alabama state House and Senate primary contests reported in the Secretary of State's complete 67-county 2022 precinct-workbook archive. The deterministic projection contains 60 party contests, 148 named candidate rows, and 564,383 votes: 14 Senate and 46 House contests, split across 17 Democratic and 43 Republican contests.

This is a factual context corpus, not an office-universe or winner projection. The parser excludes the source's `Over Votes` and `Under Votes` bookkeeping rows, sums each named candidate across every populated county precinct cell, and records 310 county-workbook candidate rows and 5,516 populated vote cells. It does not create zero, uncontested, no-primary, winner, nominee, incumbent, ideology, or identity facts for districts or parties not represented by candidate-bearing rows. Alabama state-legislative offices were not scheduled in the 2024 election cycle.

Every contest retains `sourceWinnerStatus: not_marked_by_source`, null winner and identity fields, and `formulaEligible: false`. The source is the already retained official archive `al-2022-primary-precinct-results`; a separate candidate-level certification instrument is not claimed. The projection is exposed on the Sources page through local-context coverage v8 and does not alter Priority Index v0.8.

## Reproduction

- `npm run generate:rapid-alabama-state-legislative`
- `npm run generate:rapid-local-context-coverage-v8`
- `npx vitest run src/rapid-acquisition/alabama-state-legislative-results.test.ts src/ui/rapid-local-context-coverage.test.ts`
- `npm run typecheck`
- `npm run data:verify`

Pinned Alabama artifact: 65,059 bytes; SHA-256 `2429dfd61f49e2b7822c10d8edfbea35735537f25205b5422fa359c0e188c64b`; contest-set SHA-256 `33304fff0fc92f314a3929745b4e5d809fed4a8bf401608f5596a5c87125d284`; package SHA-256 `6bbd639119ccfbe103568e40add2f7556af64f7a3379967b2d53a9388e183bdd`.

Pinned local-context coverage v8: 5,404 bytes; SHA-256 `3e781afc71b5b0a08cfad0137ec2cbc1a6bb346daeee84f28816d6b8cf6fae80`; artifact-set SHA-256 `bda4d5257daf40aa6d4a3a395856f73a5f19ebbf7ca843012c407fe90fd9ebdc`; package SHA-256 `345124556474378a7eb155c849553a9e5cf107f7df9df1ae1ce59a63650568f3`.
