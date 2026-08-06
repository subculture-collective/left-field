# NJ/PA primary identity-geography joint review package v2

Date: 2026-08-06
Status: proposed reviewer package; unapproved, score-ineligible, publication-ineligible

## Outcome

This package recomposes the immutable 41-row NJ/PA joint reviewer queue with geography v2. It preserves every identity observation and linkage coordinate from joint v1 while replacing only the geography projection. The nine New Jersey 2026 rows now carry explicit current `2022-2031` state-plan continuity evidence instead of an authority-pending state.

| Joint category | Rows | Required treatment |
| --- | ---: | --- |
| Identity and geography candidates | 33 | Review identity and geography independently under the existing decisions. |
| Geography candidate; identity unresolved | 8 | Review geography while retaining identity as unresolved. |
| Total | 41 | No row is automatically approved or score eligible. |

The identity evidence mix remains 18 exact-name observations, nine derived relationships, six medium-confidence inferences, and eight unresolved rows. All 41 geography relationships are candidates. The former eight identity-candidate/CD120-pending rows move into the both-candidate category, and the former one identity-unresolved/CD120-pending row moves into the geography-candidate/identity-unresolved category.

## Lineage and evidence boundary

The output has exactly two direct source-lock parents:

- `nj-pa-primary-identity-geography-review-package-v1`
- `nj-pa-primary-geography-compatibility-candidate-v2`

Every output row retains its joint-v1 row digest and exact identity payload. Its geography-v2 parent must point to the same geography-v1 row embedded by joint v1, and the join must match the linkage ID, contest digest, seat-cycle ID, state, district, and cycle. Each output receives a fresh v2 digest.

The nine 2026 rows retain historical Congress session `120` with `historicalGeoid: null`: no Census CD120 product is claimed. Their state-plan evidence points to the New Jersey authority receipt and retains the components-report conflict boundary. The components report remains excluded from adopted block-membership evidence.

## Decision and lifecycle boundary

The package creates no independent decision. It inherits the two existing proposal-owned decisions:

- `approve-historic-primary-candidate-identity-resolution-v1`
- `approve-historical-district-cd119-compatibility-v1`

Both remain unresolved, with no proposed resolution, reviewer, or review timestamp. The identity decision retains its identity-linkage evidence. The geography decision advances its evidence references to the geography-v2 package and row set, but that stronger evidence does not constitute approval or decision closure.

All 41 rows retain `identityApproved: false`, `geographyApproved: false`, `jointApproved: false`, and `scoreEligible: false`. The package contains no numeric evaluator values, publication state, promotion, deployment, reviewer identity, or signature. Joint v1 remains immutable and continues to record the historical pre-authority matrix.

## Reproduction

```bash
npm run generate:nj-pa-primary-joint-review-v2
npx vitest run src/ingestion/elections/nj-pa-primary-identity-geography-review-package-v2.test.ts --maxWorkers=1
npm run data:verify
```

The canonical artifact is `data/metadata/nj-pa-primary-identity-geography-review-package-v2.json`: 100,437 bytes, SHA-256 `ce6afdd2686d1bd03ae09f7fa6c1c7e154fc23c9bc06ac71f520ad8b1d6e568b`, package SHA-256 `5524a9d24519cb34a9d0e270f669eddb7a16abf17c4fc3f49dc0f6e50eae6192`, row-set SHA-256 `e0f735c67ade78a9209df181e15e2ae049967083d6f5510a37952c926a658af8`, and parent-review-record-set SHA-256 `2aad472ad63c3319cd7ee928a93d7448024b375a9bc20c852d2c47b99add49b5`.
