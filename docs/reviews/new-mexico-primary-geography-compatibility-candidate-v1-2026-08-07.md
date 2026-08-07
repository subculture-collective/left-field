# New Mexico primary geography compatibility candidate v1 — 2026-08-07

## Outcome

This reviewer-only candidate joins all nine New Mexico incumbent-identity observations to the complete official Census CD118 and CD119 state district inventories.

- The three 2022 rows are proposed CD118-to-CD119 plan-continuity candidates. Census's retained plan-change declaration names Alabama, Georgia, Louisiana, New York, and North Carolina as the five CD119 redraw states, excluding New Mexico; both New Mexico layers independently contain the same exact numbered GEOID keys `3501` through `3503`.
- The three 2024 rows are exact CD119 session-and-GEOID-key candidates.
- The three 2026 rows remain CD120-authority pending. Their historical GEOID is null, evidence class is `authority_pending`, confidence is `none`, and compatibility-candidate status is false.

All nine rows preserve their parent identity, contest, result-authority, certification, and source-winner fields. The package creates no identity approval, geography approval, evaluator value, score, winner, nominee, publication, or deployment state.

## Evidence boundary

Both retained TIGER DBFs close exactly three numbered districts for state FIPS 35. The builder validates each archive hash, exact DBF-member hash, DBF schema and layout, session number, state identifier, district keys, and GEOIDs. It canonicalizes the source rows by GEOID because the CD118 and CD119 files use different physical row orders.

Matching plan declarations and keys are bounded compatibility evidence; they are not raw-geometry equality. The package explicitly records that it did not assess raw TIGER geometry equality, overlap thresholds, or population equivalence. Small land/water-area differences between TIGER vintages are not interpreted. CD119 is never substituted for unavailable CD120 authority.

## Review recommendation

Recommended decision: accept the six bounded 2022 and 2024 compatibility candidates while preserving all three 2026 rows as authority-pending. Safe default: keep every row excluded from evaluator and publication until authorized identity and historical-geography review.

The candidate informs the existing unresolved `approve-historical-district-cd119-compatibility-v1` decision; it creates no independent decision or reviewer resolution.

## Provenance and pins

The exact ordered direct parents are the source-selection proposal, New Mexico results receipt, New Mexico identity candidate, Census CD119 plan-change authority, New Mexico CD118 TIGER archive, and New Mexico CD119 TIGER archive.

- artifact bytes: `18168`
- file SHA-256: `65d3c31d5a8b1d59d045cfbee81789da56cc2d2aabea284cb1b40dafa9966e87`
- package SHA-256: `ac4331bd84d6a05a660cf62b2bde0c819ad404a82f33d54f8f5ac808f296e9af`
- row-set SHA-256: `e69637b098ee9f709cee64be52590c11899f4a2bbd1653f2c63d2da030193f81`

## Reproduction

```bash
npm run generate:nm-primary-geography-v1
npx vitest run src/ingestion/elections/new-mexico-primary-geography-compatibility-candidate.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The generator is create-only and byte-deterministic. The focused suite rejects input-byte drift, source-lock URL and parent-order drift, fully rehashed CD120 escalation, approval, scoring, publication, fabricated reviewer state, geometry claims, and unknown fields.
