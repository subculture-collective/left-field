# New Mexico county-office primary results — 2026-08-09

Status: retained catalog; excluded from the Priority Index.

The New Mexico Secretary of State county-result CSV exports for the June 7, 2022, June 4, 2024, and June 2, 2026 primaries contain 589 assessor, clerk, commissioner, sheriff, treasurer, and probate-judge contests. The catalog retains 966 candidate rows and 1,998,553 votes: 275 Democratic contests, 306 Republican contests, and eight Libertarian contests.

Every source row reports all enumerated precincts complete. When absentee, Election Day, and early-vote components are populated, the parser requires them to equal the candidate total; blank components remain null. County names map exactly to all 33 retained current Census county FIPS.

The 2022 export is bound to the official results archive without a separate signed certificate. The 2024 and 2026 exports are bound to retained state-canvass certification announcements, while exact certificate bytes remain unretained. The exports do not mark winners. Winner identity, current-holder identity, and formula eligibility therefore remain null or false.

Reproduction:

```sh
npm run acquire:rapid-new-mexico-county-offices
npm run generate:rapid-new-mexico-county-offices
npx vitest run src/rapid-acquisition/new-mexico-county-office-results.test.ts
npm run data:verify
```

Artifact: `data/metadata/rapid-new-mexico-county-office-primary-results-v1.json` — 966,277 bytes, SHA-256 `d06ec36e4d3fbbfeb46b7d597041906f88790b50a0acca1008948b8dff7ea3fe`; contest set `de2bc371f20453d1b98a2b44d4909a11dbf8b9cae9747877c9bb96d18c20024d`; package `3a76dd92c2175bbc153799f6c953b8bb86863dbd8831e08efef917fdfbf3a6f6`.
