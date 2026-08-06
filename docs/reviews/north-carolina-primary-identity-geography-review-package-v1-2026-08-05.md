# North Carolina primary identity/geography joint review package v1

Status: **proposed reviewer queue; not approved, published, deployed, or evaluator-eligible**

This package joins all 12 current-target North Carolina identity observations one-to-one with their geography evidence and creates four concrete, hash-bound review decisions:

- three rows have identity and exact-block geography candidates; the recommendation is to accept both relationships after documented review;
- three rows have identity candidates but split historical geography; the recommendation is to accept identity independently while keeping geography and historical-result use excluded;
- four rows have exact-block geography candidates but no reported contest/identity relationship; the recommendation is to accept geography independently without fabricating identity or a no-primary disposition;
- two rows have both unresolved identity and split geography; the recommendation and safe default are continued exclusion pending new evidence.

Every decision identifies its exact evidence records, recommendation, alternatives, consequences, confidence, blocking scope, completed work, and unresolved reviewer fields. All four use the reversible default `exclude_affected_joint_rows`, block only publication of their affected rows, and do not block unrelated work.

The separate 2022 archive-versus-canvass precedence proposal remains unresolved. Its NC-03 and NC-11 conflicts affect none of these four current target seats, but the joint package preserves the parent decision and does not silently resolve it.

The join approves nothing. All 12 records remain identity-unapproved, geography-unapproved, jointly unapproved, score-ineligible, reviewer-only, unpublished, undeployed, and excluded from evaluator use.

```sh
npm run generate:nc-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/north-carolina-primary-identity-geography-review-package.test.ts
npm run data:verify
npm run typecheck
```

Package SHA-256: `c86d4542e10c624b60e5e8080181bad2ecfc6239365e19007e70109d6e717170`

Review-record-set SHA-256: `8cffac2db7f12ddac1167a441e93792f9b082db07a4c2490e707e8e4b59a2d12`

Decision-set SHA-256: `2937f9a65ef3c61195665def187247be47fc1790bea2f6f18a8b4b43cb4cca6e`
