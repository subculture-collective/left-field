# North Carolina 2022 primary source-precedence decision — 2026-08-05

Status: proposed reviewer decision; unresolved, reviewer-only, score-ineligible, and publication-ineligible.

Decision ID: `nc-2022-primary-archive-canvass-source-precedence-v1`

## Exact question

Which retained official source should control the four conflicting 2022 North Carolina Democratic U.S. House primary candidate totals?

## Evidence and recommendation

The complete NCSBE results archive totals 424,306 Democratic U.S. House votes. The final state canvass totals 424,321. The entire difference is reproduced across four rows: Barbara D. Gaskins +9, Joe Swartz +3, Jasmine Beach-Ferrara +2, and Jay Carey +1 in the canvass. Both source files, the parent receipt file, its package hash, and its contest-set hash are bound into the deterministic proposal.

Recommended decision: use the final state canvass for the four certified 2022 candidate totals, retain the results archive as reporting provenance, and authorize only a future reviewer-only successor candidate. This decision would not approve scoring or publication.

Safe reversible default: exclude the affected NC-03 and NC-11 rows from evaluator and publication use pending explicit review. The 31 nonconflicting 2022 candidate rows remain under the parent receipt's reviewer-only lifecycle rather than being discarded.

Alternatives are retained in the package: keep the archive totals despite the certification conflict, or exclude all 2022 results and unnecessarily withhold the 31 nonconflicting totals.

The decision does not resolve current-incumbent identity, historical geography, primary disposition, progressive classification, evaluator eligibility, or publication. Reviewer identity, resolution, rationale, and timestamp remain null.

Reproduce and verify with:

```sh
npm run generate:nc-primary-source-precedence-decision
npm run test:run -- src/ingestion/elections/north-carolina-primary-source-precedence-decision.test.ts
npm run data:verify
```
