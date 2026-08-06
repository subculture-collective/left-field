# Virginia primary identity/geography review package v1

Date: 2026-08-06
Status: proposed reviewer queue; not approved, score-bearing, published, or deployed

## Result

The package joins the twelve committed Virginia identity and geography observations one-to-one. Its review matrix contains three identity-and-geography candidates, one geography candidate with the explicit 2024 VA-11 Connolly-to-Walkinshaw identity no-match, and eight geography candidates whose historical result/identity evidence remains absent and unassessed.

Five decisions remain independent and unresolved:

1. Retain official result and event-level certification authority for the four present target contests without claiming individual contest certificates, nominee conclusions, or current-identity approval.
2. Review all twelve bounded geography candidates without claiming raw geometry equality, overlap, or population equivalence.
3. Review only the three proposed identity relationships: two exact observations and one finite middle-initial expansion.
4. Preserve reported, predecessor-no-match, and absent-result distinctions across all twelve records; do not convert absence into zero or a negative disposition and do not import unofficial 2026 evidence.
5. Preserve progressive-classification and evaluator exclusion across all twelve records until separately evidenced and reviewed.

Each decision has a reversible exclusion default, consequences, alternatives, an exact evidence-record scope, and a proposed/null review object. Resolving one cannot resolve another or mutate either parent. Every identity, geography, and joint approval is false; every record is score-ineligible and publication remains false.

Artifact SHA-256: `2b3c67da9ed5cc8833ee1dc2bf4139edb7757b6e80d3533b93ffd1914cc12af8`
Package SHA-256: `a5588e14fc266549f7ac6871d4f6235f2855992cd7df4d9471f8881ae6ab07e0`
Record-set SHA-256: `598c7c95b91b2c2e7c70ae26255e2e202b6555714b60e3b1895fd9f3bfcd2483`
Decision-set SHA-256: `011978792c08ec2d2d0750ea9d08de5e910422f2f969a39bb733fd17ac4914fb`

The output is a source-locked `review_proposal` with exactly three direct parents: the source-selection proposal, Virginia identity candidate, and Virginia geography candidate. Result, Census, and TIGER sources remain inherited through the validated candidate lineage.

## Reproduction

```bash
npm run generate:va-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/virginia-primary-identity-geography-review-package.test.ts
npm run typecheck
npm run data:verify
```
