# California primary identity/geography review package v3

Date: 2026-08-07
Status: proposed reviewer queue; not approved, score-bearing, published, or deployed

## Result

This immutable composition preserves all 126 California joint-v2 current-target records and attaches the retained split-crosswalk policy dossier to exactly 38 current-target 2026 records whose AB 604-to-CD119 relationship remains `crosswalk_review_required`.

The existing joint partition is unchanged:

- 80 identity-and-geography candidates;
- eight geography-candidate/identity-unresolved records;
- 34 identity-candidate/crosswalk-review-required records;
- four identity-unresolved/crosswalk-review-required records;
- 114 identity candidates and 88 geography candidates;
- zero joint approvals and zero score-eligible records.

The dossier assesses 48 non-identical AB 604-to-CD119 block relationships. Thirty-eight map one-to-one to the current-incumbent joint queue. Ten statewide-geography-only rows remain package-level context and create no joint record. The four exact-membership 2026 districts—34, 36, 37, and 43—are outside the split-policy scope and receive no policy attachment.

Each attached projection binds the exact v2 row hash and dossier row hash, contest, seat, district, source and target plans, block counts, PPM ratios, and source-to-target split list. Those counts remain explicitly 2020 Census tabulation blocks—not population, voters, turnout, partisan performance, or electoral weight.

The package inherits `california-split-crosswalk-methodology-v1` as a non-independent proposed decision. Its recommendation remains `retain_exact_block_membership_only_rule`; its decision, reviewer, timestamp, and rationale remain null. The recommendation is not treated as approval. A future methodology resolution would still not approve any row automatically.

No population, voter, turnout, partisan, threshold, district-number-continuity, largest-overlap, fractional evaluator, or raw-geometry rule is introduced. Identity, geography, joint approval, California top-two formula compatibility, evaluator eligibility, scoring, publication, and deployment remain separate unresolved gates.

- Artifact SHA-256: `8e26f36a1a845061a7c3b7783e79aa85100cf3599b4373d753ef26df93667de1`
- Package SHA-256: `9350724227b439989b0db365ab63f28dad2f0446d32da5c07ae68d3d250185eb`
- Review-record-set SHA-256: `bdfa3b5b879e0245260b88ffcaea0da4d8658884c40a097393910c637f69e940`
- Split-policy-projection-set SHA-256: `e7d6b9c638e84fd177be0ab23a463ea70f22f9bbd4a482f99fafe05d21e39589`
- Decision-review-set SHA-256: `d113a0db58480276232fe2541d42b2e8727bf4bffc758af4ca7e334b2f2ce597`

The source-locked output has exactly two ordered direct parents: California joint v2 and the split-crosswalk policy dossier. Official AB 604/Census block assignments, the crosswalk candidate, geography v2, identity evidence, and result evidence remain hash-bound transitive lineage. Generation reconstructs both parents through their complete retained input bundles and existing semantic validators.

## Reproduction

```bash
npm run generate:ca-primary-joint-review-v3
npm run test:run -- src/ingestion/elections/california-primary-identity-geography-review-package-v3.test.ts
npm run typecheck
npm run data:verify
```
