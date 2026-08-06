# Illinois primary identity/geography review package v1

Date: 2026-08-05
Status: proposed reviewer queue; not approved, evaluator-eligible, score-bearing, published, or deployed

## Review matrix

The package uses a geography-led union over all 34 retained Illinois district-cycle contests. It joins parent rows on contest ID, contest hash, seat-cycle ID, district, and cycle without narrowing geography coverage to the 28-row current-target identity candidate.

| Joint category | District-cycle scope | Records |
| --- | --- | ---: |
| Identity and geography candidates pending independent review | Districts 01–11, 13, 14, and 17 in both 2022 and 2024 | 28 |
| Geography candidate with identity outside current-target scope | Districts 12, 15, and 16 in both cycles | 6 |

The identity evidence partition is 20 exact-name candidates, eight bounded derived-name candidates, and six records outside the current-target identity scope. The six out-of-scope records contain null identity parent hashes and null person/candidate fields; the join does not fabricate an identity observation, BioGuide relationship, candidate name, or approval for them. All 34 records retain their exact geography parent rows.

## Inherited gates

The package preserves the exact four unresolved parent gates:

- `retain_final_state_canvass_or_certification`
- `review_incumbent_candidate_identity`
- `review_historical_district_compatibility`
- `review_progressive_candidate_classification`

Every record keeps final certification and progressive classification at `not_retained`. Evaluator use remains excluded pending certification, identity, historical-geography, and progressive-classification review. The join approves no parent fact and emits no evaluator value or score.

## Proposed decisions

| Decision | Recommendation | Evidence records | Safe reversible default |
| --- | --- | ---: | --- |
| `il-primary:accept-identity-links-v1` | Accept the 28 exact or bounded derived current-target identity links while preserving the absence of a direct state-export person identifier and leaving six out-of-scope records without identities. | 28 | Exclude affected records from evaluator use and publication. |
| `il-primary:accept-geography-compatibility-v1` | Accept all 34 geography candidates under the retained Census authority and exact numbered inventories without claiming raw geometry equality. | 34 | Exclude affected records from evaluator use and publication. |
| `il-primary:retain-certification-exclusion-v1` | Retain evaluator and publication exclusion until final statewide canvass or certification authority is retained. | 34 | Exclude affected records from evaluator use and publication. |
| `il-primary:retain-progressive-classification-exclusion-v1` | Retain exclusion because this package contains no progressive-classification evidence. | 34 | Exclude affected records from evaluator use and publication. |

Each decision is concrete, evidence-bound, and independently reversible. Every decision includes two alternatives, two consequences, high confidence, completed work, `blocksAffectedPublication: true`, `blocksOtherWork: false`, and `review: { status: "proposed", reviewer: null, reviewedAt: null, resolution: null }`. Resolving one decision cannot mutate or imply resolution of another.

The package-level review and all four inherited decision resolutions are also null. There are zero identity approvals, geography approvals, joint approvals, automatic approvals, score-eligible records, publication changes, or deployments.

## Immutable identities

- Artifact: `data/metadata/illinois-primary-identity-geography-review-package-v1.json`
- Byte size: `85,008`
- File SHA-256: `795843b2b1a7e8a276b0ccfdcbab75f251adc5db4ae227c6a1f56601dc596c37`
- Parent-projection SHA-256: `00580f013d9f208951f194c798c1c45825daa5903eef70e6dda366d7f2b6698e`
- Review-record-set SHA-256: `4df05250803ce13fc85bf8bec43cc341d89e961855a2da09bca2497d3d983a59`
- Decision-set SHA-256: `e73a6bf0e4428692cd1571c2e9f8fc33b3c6384797098359a8021e318592ad54`
- Package SHA-256: `3eccc7f17da59e4a3bb427e339d7af63b0181327b1e80c80226b43ae173a474d`

The builder recomputes raw parent JSON hashes, validates the frozen proposal, identity, and geography candidates, checks their exact source-lock lineage, and proves that all 28 identity rows and all 34 geography rows are consumed exactly once. The validator pins the 34-row parent projection, exact union categories, record hashes, decision evidence partitions, record set, decision set, and package hash. It rejects fabricated identity state, unknown fields, approval or evaluator promotion, missing or duplicate evidence, and fully rehashed parent-fact substitution.

## Reproduction

```bash
npm run generate:il-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/illinois-primary-identity-geography-review-package.test.ts
npm run data:verify
```
