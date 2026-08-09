# New Mexico county-office primary results — 2026-08-09

Status: retained catalog; excluded from the Priority Index.

The New Mexico Secretary of State county-result CSV exports for the June 7, 2022, June 4, 2024, and June 2, 2026 primaries contain 589 assessor, clerk, commissioner, sheriff, treasurer, and probate-judge contest keys. Eight contest keys repeat candidate IDs under conflicting source projections, so the catalog quarantines those contests rather than selecting or summing one projection. The usable catalog retains 581 contests, 926 candidate rows, and 1,967,348 votes: 271 Democratic contests, 302 Republican contests, and eight Libertarian contests.

Every source row reports all enumerated precincts complete. When absentee, Election Day, and early-vote components are populated, the parser requires them to equal the candidate total; blank components remain null. County names map exactly to all 33 retained current Census county FIPS.

The 2022 export is bound to the official results archive without a separate signed certificate. The 2024 and 2026 exports are bound to retained state-canvass certification announcements, while exact certificate bytes remain unretained. The exports do not mark winners. Winner identity, current-holder identity, and formula eligibility therefore remain null or false.

Reproduction:

```sh
npm run acquire:rapid-new-mexico-county-offices
npm run generate:rapid-new-mexico-county-offices
npx vitest run src/rapid-acquisition/new-mexico-county-office-results.test.ts
npm run data:verify
```

Artifact: `data/metadata/rapid-new-mexico-county-office-primary-results-v1.json` — 954,148 bytes, SHA-256 `4d1ec52441fbf07d9e9a20cd77ff27d44e1f1a33136dfb17db4372f3da24adc6`; contest set `a619339d44029f2281801e977ab7cd2eb5fccebe9548ead976bbefdcbccbff30`; package `d99d29b51284919f06d5d406444ef9ad52eef52af1fb289d8cc75cc3a1c71328`.
