# Colorado primary geography compatibility candidate v1

Date: 2026-08-06
Status: proposed reviewer-only candidate; not approved, score-bearing, published, or deployed

The package joins all 12 Colorado identity observations to complete official CD118 and CD119 Colorado district-key inventories.

- Four 2022 rows are proposed as CD118-to-CD119 continuity candidates using the Census no-plan-change declaration and matching GEOID keys.
- Four 2024 rows are exact CD119 session-and-key candidates.
- Four 2026 rows remain CD120-authority pending. Their historical GEOID is null, evidence is `authority_pending`, confidence is `none`, and compatibility-candidate status is false.

Every retained layer closes numbered districts 01 through 08; this target package uses CO-01, CO-02, CO-06, and CO-07. The package explicitly records that raw TIGER geometry equality, overlap, and population equivalence were not assessed. Geography creates no identity, winner, nominee, result, approval, evaluator value, or score.

Artifact SHA-256: `1e9e6aa7a56ffe7c5004774c93986d4f8bacc27ecd26a266813221995624105f`
Package SHA-256: `22c04b207893b8715299ee9893167bb61ff413abf3b8712edbaa790d963d1af3`
Row-set SHA-256: `62e51d28abedaee49b3b9d1dfd10dff4406bd56916e223532b4b67c380a59200`

Recommended decision: accept only the eight bounded 2022/2024 compatibility candidates, while preserving all four 2026 rows as pending. Safe default: keep every row excluded from evaluator and publication.

```bash
npm run generate:co-primary-geography-compatibility-v1
npm run test:run -- src/ingestion/elections/colorado-primary-geography-compatibility-candidate.test.ts
npm run typecheck
npm run data:verify
```
