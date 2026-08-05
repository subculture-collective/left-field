# NJ/PA primary identity-geography joint review package v1

Status: **proposed reviewer-only join; not an independent decision, approval, score input, promotion, release, or deployment**.

## Result

This immutable package joins the exact 41 rows in the current-incumbent identity candidate to the exact 41 rows in the geography-compatibility candidate. It gives the reviewer one queue without changing either parent conclusion:

| Joint category | Rows | Required treatment |
| --- | ---: | --- |
| Identity and geography candidates | 25 | Review identity and geography independently under their existing decisions. |
| Identity candidate; CD120 geography pending | 8 | Review identity, but retain geography as pending until authoritative CD120 evidence exists. |
| Geography candidate; identity unresolved | 7 | Review geography, but retain identity as unresolved. |
| Identity unresolved; CD120 geography pending | 1 | Retain both states as pending; no relationship decision is available. |

The identity evidence mix remains 18 exact-name observations, nine derived relationships, six medium-confidence inferences, and eight unresolved rows. The geography evidence remains 32 candidates and nine CD120-pending rows. All 41 rows have `identityApproved: false`, `geographyApproved: false`, `jointApproved: false`, and `scoreEligible: false`.

## Decision ownership and safe default

The August 4 source-selection proposal remains the sole owner of:

- `approve-historic-primary-candidate-identity-resolution-v1`
- `approve-historical-district-cd119-compatibility-v1`

The package contains two hash-bound `parentDecisionReviews`. They copy each parent question, recommendation, reversible default, and unresolved state for inspection, but set `inherited: true`, `createsIndependentDecision: false`, and `supersedesDecisionIds: []`. They do not propose a resolution or create a third decision.

The safe default is to exclude every row from evaluation and publication until these exact two parent decisions and every other applicable authority, selection, classification, human-review, and publication gate are approved. `publicationDecisionPresent: false` and `promotionNotAssessed: true` are explicit.

## Privacy and integrity

The joined rows retain stable linkage, contest, seat-cycle, evidence-class, disposition, confidence, and parent-row hashes. They deliberately exclude candidate names, candidate numbers, votes, incumbent/winner markers, addresses, contact details, dates of birth, donor records, raw geometry, and raw source text. The parent candidates remain available for authorized evidence inspection.

Generation validates the exact proposal, linkage, and geography bytes; the proposal's two unresolved decisions; exact 41-row identity/contest/seat closure; and one retained source-lock record for each direct parent with the required path, kind, and hash. The validator independently enforces category semantics before checking the pinned package hash.

## Immutable identity and reproduction

```bash
npm run generate:nj-pa-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/nj-pa-primary-identity-geography-review-package.test.ts
node scripts/verify-source-lock.mjs
npm run typecheck
```

- Artifact: `data/metadata/nj-pa-primary-identity-geography-review-package-v1.json`
- Artifact SHA-256: `78ef074c54a36b2a62af851d210212b3b03f0e2d4b8c4950c7999ffd5598dd46`
- Package SHA-256: `63f3e0fa2e5514a5a91c10e75c641e81cc7b765ae71258480b2e1969c24f3666`
- Row-set SHA-256: `17d99573a6cc298dae70de7fe878847266dbeb5a5fbca549d6436e522ef7ccf8`
- Parent-review-record-set SHA-256: `855d5ad49098dffe0405781cd963c6055d95d3868b1cfcdcaac528aa133b11a3`
- Automatic approvals: `0`
- Score-eligible rows: `0`
