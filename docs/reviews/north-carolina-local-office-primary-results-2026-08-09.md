# North Carolina local-office primary results — 2026-08-09

Status: retained catalog; excluded from the Priority Index.

This receipt parses the North Carolina State Board of Elections' official precinct-result archives for the May 17, 2022, March 5, 2024, and March 3, 2026 primaries. It selects seven positive office families: county commissioner, board of education, register of deeds, clerk of superior court, county sheriff, municipal council or commissioner, and municipal mayor. Ballot questions, referenda, bonds, taxes, and beverage elections are excluded.

The retained catalog contains 1,095 contests, 3,758 candidate rows, 99,614 precinct-candidate rows, and 12,273,926 votes. Party context is preserved as 228 Democratic, 546 Republican, and 321 nonpartisan contests. Multi-seat `Vote For` values are retained. Fourteen source rows with a blank candidate name and zero votes are recorded as excluded placeholders rather than candidates.

County names join exactly to the retained current Census county universe, covering all 100 North Carolina county FIPS across the three-cycle union. Every selected result row independently reconciles Election Day, early or one-stop, mail, and provisional channels to its source total.

The archives do not mark winners. The receipt therefore makes no winner inference from vote rank, no current-holder identity claim, and no scoring claim. Every contest remains `formulaEligible: false` until a separately versioned local-office method and current-holder identity layer exist.

Reproduction:

```sh
npm run generate:rapid-north-carolina-local-offices
npx vitest run src/rapid-acquisition/north-carolina-local-office-results.test.ts
npm run typecheck
npm run data:verify
```

Artifact: `data/metadata/rapid-north-carolina-local-office-primary-results-v1.json` — 1,496,876 bytes, SHA-256 `768006a4fb5e926ec6643c4c793d85ac137160946757ab9b9b91a276e7e88698`; contest set `48d1820102b0d9f6644a20750fc238876034c8ab468e99ee7c2bc1fb599a2756`; package `d1d26b909ed73041a47d73022b9c4e5b6fd453db1f4c604613fbdc0ae405fb1c`.
