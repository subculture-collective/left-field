# Ohio Democratic state-legislative primary context — 2026-08-09

Status: retained context; excluded from the Priority Index.

The retained Ohio Secretary of State Democratic summary workbooks for March 19, 2024 and May 5, 2026 are labeled Official Canvass. Their `Master` sheets contain 221 state-legislative party contests: 31 state Senate and 190 state House contests, 282 candidate rows, and 1,632,849 votes. Candidate totals reconcile exactly to the workbook's 88 county rows for every contest.

The catalog preserves the raw Democratic label and 17 named write-in candidates. It does not infer a winner from plurality or one-candidate contests, resolve current-holder identity, or supply a state-legislative scoring method. The corresponding Republican workbooks and the separate August 2022 state-legislative primary workbooks are named by the retained official file manifest but their bytes are not retained; the catalog therefore describes only the two Democratic source cycles and does not synthesize Republican or 2022 rows.

Reproduction:

```bash
npm run generate:rapid-ohio-state-legislative
npx vitest run src/rapid-acquisition/ohio-state-legislative-results.test.ts
npm run data:verify
```

Artifact: `data/metadata/rapid-ohio-state-legislative-democratic-primary-results-v1.json` — 295,128 bytes, SHA-256 `f46f84c35e42e3c7f2981dc04844da9ded143f65ac962fc42787736e2ce24dda`; contest set `18bb4c24a89239e924f85f397d58d46adb817130cd51ed50538a2ca8084126a2`; package `45612e0ce2949555193c1372cc3a6302c110f1776a47e2da8a63b5b0896cee04`.
