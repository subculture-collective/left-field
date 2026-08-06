# California primary identity-geography review package v2

Date: 2026-08-06  
Status: proposed reviewer package; unapproved, score-ineligible, publication-ineligible

## Outcome

This package recomposes the immutable 126-record California joint reviewer queue with California geography v2. It preserves every identity observation, top-two result coordinate, formula exclusion, and unresolved decision from joint v1 while replacing the 42 target-seat CD120 authority-pending projections with exact block-membership or crosswalk-review evidence.

The resulting review matrix is:

| Review category | Records |
|---|---:|
| Identity and geography candidates | 80 |
| Geography candidate, identity unresolved | 8 |
| Identity candidate, geography crosswalk review required | 34 |
| Identity unresolved, geography crosswalk review required | 4 |
| Total | 126 |

Identity candidates remain 114. Geography candidates increase from 84 to 88 because the target universe contains all four exact CD120 candidates: districts `34`, `36`, `37`, and `43`. Each already has a proposed identity relationship, so only those four records move from the former identity-candidate/authority-pending category to the both-candidate category.

The joint queue covers 42 of California's 52 2026 House districts. It therefore contains 38 crosswalk-review rows, not all 48 statewide split rows. The four identity-unresolved joined splits are districts `06`, `11`, `26`, and `38`; ten geography rows are outside this incumbent-target joint scope. District 12 remains a noncandidate guard case: 8,894 AB 604 source blocks map to same-numbered CD119 district 12, whose target set contains 8,895 blocks.

## Lineage and preservation

The output has exactly two direct source-lock parents:

- `california-primary-identity-geography-review-package-v1`
- `california-primary-geography-compatibility-candidate-v2`

Every record retains its v1 record digest and exact identity payload. Its v2 geography row must point back to the same geography-v1 row used by joint v1 before the composer accepts the join. The output then records the geography-v2 row digest and, for every joined 2026 record, its exact source-locked AB 604/CD119 block-crosswalk metrics.

The composition creates no independent decision. The existing identity, geography, and California top-two decision IDs remain bound with null resolutions. Joint v1 remains immutable and is not treated as factually approved.

## Lifecycle boundary

All 126 records remain `top_two_open_primary`, `confirmed_incompatible_with_party_primary_metrics`, and excluded pending authorized identity, geography, and top-two review. The package records zero identity approvals, geography approvals, joint approvals, score-eligible records, or numeric evaluator values. It supplies no reviewer identity, review timestamp, resolution, publication, or deployment.

Exact block equality is candidate evidence only. The composer does not promote split rows through an overlap threshold, district-number continuity, population, voter or electoral weights, raw geometry, or legal-permanence inference.

## Reproduction

```bash
npm run generate:ca-primary-joint-review-v2
npx vitest run src/ingestion/elections/california-primary-identity-geography-review-package-v2.test.ts --maxWorkers=1
npm run data:verify
```

The canonical artifact is `data/metadata/california-primary-identity-geography-review-package-v2.json`: 369,996 bytes, SHA-256 `ec9a76edea1caf3a3704f4762ab12afb826392c05c8128a1755614453f981ab7`, package SHA-256 `1ec9bca50cfb6aee9747d804b28bd5a581a477226de8f52305e5af74453abeff`, and record-set SHA-256 `d0ce9f5d8cc96509a3b77a1d6b2a7dcbe55fcc2378b189eb5c7a6afce7b38550`.
