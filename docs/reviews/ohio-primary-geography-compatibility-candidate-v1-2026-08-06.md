# Ohio primary geography compatibility candidate v1

Date: 2026-08-06
Status: proposed reviewer-only geography candidate; not approved, score-bearing, published, or deployed

## Result

The package joins all ten closed Ohio identity observations to a complete official CD119 Ohio district-key inventory.

- Five 2024 rows are exact CD119 session-and-key candidates for OH-01, OH-03, OH-09, OH-11, and OH-13.
- Five 2026 rows remain CD120-authority pending. Their historical GEOID is null, evidence is `authority_pending`, confidence is `none`, and compatibility-candidate status is false.
- The 12 partial 2022 county segments produce zero geography observations and zero CD118-to-CD119 continuity candidates.

The retained TIGER DBF closes all 15 numbered Ohio districts: state 39, session 119, district keys 01 through 15, and GEOIDs 3901 through 3915. The retained Census plan-change page provides CD119 context and does not authorize a CD120 continuity inference. No CD118 layer or Ohio county result is treated as a direct geography parent.

Every row preserves its identity parent hash, contest ID and hash, result authority, certification boundary, and `not_marked_by_source` winner state. Geography creates no identity, winner, nominee, result, approval, evaluator value, or score.

The package explicitly records that raw TIGER geometry equality, overlap, and population equivalence were not assessed. The safe default is to keep all ten rows excluded from evaluator and publication. The recommended geography decision is to accept only the five exact 2024 CD119 key candidates while preserving all five 2026 rows as pending.

Artifact SHA-256: `6410d7bbb653994c6b624840eb993c708504f9facd31d169e24048576eb97da5`
Package SHA-256: `f45684cde798a8e3b6f6306b48255ef208520db2eccf5e5a7992ddf1b05ff924`
Row-set SHA-256: `140e09197591c86d93d3f526c4bd153bb132113642942b5237abbe13d9939a7e`

Every identity and geography approval remains false. Review status is proposed with null reviewer, timestamp, and resolution; score and publication eligibility remain false.

## Reproduction

```bash
npm run generate:oh-primary-geography-compatibility-v1
npm run test:run -- src/ingestion/elections/ohio-primary-geography-compatibility-candidate.test.ts
npm run typecheck
npm run data:verify
```
