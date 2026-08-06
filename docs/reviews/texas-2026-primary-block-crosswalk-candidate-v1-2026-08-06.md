# Texas 2026 primary block crosswalk candidate v1

## Outcome

This reviewer-only candidate resolves the missing authoritative-plan input for all 26 Texas 2026 primary event observations while preserving every regular/runoff and reported/unobserved result state from the Texas geography v1 parent.

The comparison joins the Texas Legislative Council's enacted PlanC2333 assignment to the Census CD119 Texas assignment on the complete common universe of 668,757 unique 2020 Census tabulation-block GEOIDs. Both plans contain all 38 numbered Texas districts. Exactly 192,131 blocks have different district assignments between the two layers.

None of the thirteen in-scope PlanC2333 source districts (`07`, `09`, `16`, `18`, `20`, `28`, `29`, `30`, `32`, `33`, `34`, `35`, and `37`) has a block set identical to the same-numbered CD119 target district. The package therefore creates zero exact-membership candidates and retains all 26 event rows as `crosswalk_review_required`.

| Result | Count |
|---|---:|
| Event observations | 26 |
| Unique PlanC2333 source districts | 13 |
| Exact block-membership candidates | 0 |
| Split crosswalk rows requiring review | 26 |
| Automatic approvals | 0 |
| Score-eligible rows | 0 |

## Method and boundaries

Exact equality of the complete source and target district block sets is the only promotion rule. District-number continuity and overlap percentages are not thresholds. Split shares use largest-remainder allocation to total exactly 1,000,000 parts per million for each source district. Block counts and shares are explicitly not population, voter, partisan, or electoral weights.

PlanC2333's election-use statement is bounded to the retained 2026-08-06 authority cutoff and records the pending Supreme Court appeal. The package does not assess legal permanence. Census had not published a CD120 Block Equivalency File at the cutoff, so the source assignment is accurately identified as the Texas Legislative Council PlanC2333 file rather than a Census CD120 product.

Every row preserves its parent identity evidence, contest reference or null contest, source-observation state, winner marker, certification state, regular/runoff event identity, and result disposition. All compatibility and identity approvals remain false; review identity/timestamps/resolution remain null; evaluator values, score eligibility, publication eligibility, and deployment claims remain absent.

The generated artifact is 83,408 bytes with file SHA-256 `801184e7330ffa1db233d9699e2b4bb308fc0fa941cc8aba0df800ec542794d5`, package SHA-256 `4d300b426ebf4bf9b25a13a4172f0121efc8932716ffb476550779a74b4f6e84`, and row-set SHA-256 `48b4dea1ff609b74c5a5faf325847650d90a82407b9a643e47a9c29f9f502046`.

## Reproduction

```bash
npm run generate:tx-2026-primary-block-crosswalk-v1
npx vitest run src/ingestion/elections/texas-2026-primary-block-crosswalk-candidate.test.ts
npm run data:verify
```

The next additive step is Texas geography v2: compose the immutable geography v1 parent with this candidate, replacing only the 26 authority-pending geography evidence states. Because every relationship is split, geography v2 must still create zero new 2026 compatibility candidates.
