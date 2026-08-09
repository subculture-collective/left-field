# House Priority Index down-ballot activation v0.7 — 2026-08-09

V0.7 adds one exact at-large score input: North Dakota. The retained CD119 block-equivalency projection closes all 53 counties to ND-AL, and the retained 2024 House projection supplies complete, unsuppressed statewide rows for Julie Fedorchak, Trygve Hammer, and write-ins. The source is labeled `research_fallback`; no winner is inferred.

## Calculation

| Measure | Value |
| --- | ---: |
| Democratic House candidate votes | 109,231 |
| All House candidate votes, including write-ins | 359,787 |
| Democratic House share | 30.36% |
| Harris share | 30.77% |
| House minus Harris | -0.41 points |
| Down-ballot component | 48.0 |
| Inverse ballots/CVAP component | 69.08 |
| Active-registration/CVAP component | missing |
| Demographic opportunity | 70.61 |
| Available local weight | 70% |
| Renormalized local context | 63.3 |
| v0.6 → v0.7 score | 5.9 → 13.6 |

The local formula retains its fixed subweights: 40% inverse ballots/CVAP, 30% inverse active registration/CVAP, 20% down-ballot overperformance, and 10% demographics. North Dakota has the first, third, and fourth components. Those available weights sum to 70%, exceed the 60% activation minimum, and include a direct election-administration measure. The 30% registration subweight is omitted and the available 70% is renormalized; it is not assigned zero or another estimate.

Vermont remains inactive because it has demographics and the House comparison but no retained turnout or registration measure. Alaska remains inactive because the retained 2024 House projection has no strict `TOTAL` rows. No split county is allocated, no source party label is silently rewritten, and no score other than ND-AL changes from v0.6.

Reproduce with:

```text
npm run generate:house-score-v07-active
npx vitest run src/rapid-acquisition/house-score-v07-active.test.ts src/lib/house-priority-index.test.ts src/ui/rapid-expansion-status.test.ts
npm run typecheck
npm run data:verify
```
