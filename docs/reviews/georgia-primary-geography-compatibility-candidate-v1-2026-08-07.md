# Georgia primary geography compatibility candidate v1

## Outcome

This reviewer-only package joins all 12 Georgia current-incumbent identity observations to exact Census geography evidence without flattening the 119th-Congress redraw or inventing a 120th-Congress plan.

| Cycle/evidence | Disposition | Count |
|---|---|---:|
| 2022 CD118-02 → CD119-02 | `exact_block_membership_candidate` | 1 |
| 2022 CD118-04/05 → CD119-04/05 | `crosswalk_review_required` | 2 |
| 2022 source CD118-07 → current CD119-06 | `no_same_block_membership_no_geography_candidate` | 1 |
| 2024 CD119 exact session/key | `same_cd119_session_and_geoid_exact_key_candidate` | 4 |
| 2026 CD120 authority absent | `unassessed_cd120_authority_collection_pending` | 4 |

The 2022 Lucy McBath person-identity observation stays bound to source district 07 and current target district 06. The complete Census block crosswalk finds zero CD118-07 blocks in CD119-06, so this row is explicitly not a geography candidate. It does not select district 13 or 4 based on larger raw block counts. The split district 4 and 5 rows likewise remain review-required without an overlap threshold.

All four 2024 rows use the same 119th-Congress session and exact Georgia CD119 GEOID keys from the complete 14-row TIGER inventory. All four 2026 rows retain session 120, null historical GEOIDs, `authority_pending`, and no candidate. CD119 is not substituted for unavailable CD120 evidence.

No raw geometry equality, population equivalence, identity approval, geography approval, winner, nomination, runoff advancement, evaluator value, score, publication, or deployment state is created. Every row remains proposed and excluded pending authorized identity and historical-geography review.

## Integrity closure

- Artifact bytes: 26,094
- File SHA-256: `dda2fc91a18de2ccfac09e5604089d9ec72338be4699b50988f325d7f80c8d8e`
- Package SHA-256: `ec9ec6661e280c370705835c1b4aeb552ed3710a7ee373abbb5105389fb7b206`
- Row-set SHA-256: `1aa4005af1d92db89fc31ee16376ed188674c29a088017ecabd9c2e9c790cbcb`

The output has exactly five ordered direct parents: source-selection proposal, Georgia result receipt, Georgia identity candidate, Georgia CD119 TIGER layer, and Georgia block-crosswalk candidate. Validation reconstructs the crosswalk from its retained Census inputs, checks all parent package/set hashes and lock topology, and rejects fully rehashed CD120 escalation, split/zero-overlap promotion, approval, scoring, publication, and unknown evaluator fields.

## Reproduction

```bash
npm run generate:ga-primary-geography-v1
npx vitest run src/ingestion/elections/georgia-cd118-cd119-block-crosswalk-candidate.test.ts src/ingestion/elections/georgia-primary-geography-compatibility-candidate.test.ts
npm run typecheck
npm run data:verify
```
