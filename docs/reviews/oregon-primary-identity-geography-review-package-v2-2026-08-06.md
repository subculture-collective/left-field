# Oregon primary identity-geography review package v2

Date: 2026-08-06

Status: proposed reviewer package; unapproved, score-ineligible, publication-ineligible

This package composes the immutable 15-record Oregon joint-v1 reviewer queue with Oregon geography v2. Every v1 identity observation and record coordinate is retained, each record carries its v1 review-record SHA-256, and the geography payload is replaced only through an exact contest/hash/seat/district/cycle join to geography v2.

The resulting queue has 13 identity-and-geography candidates and two geography-candidate/identity-unresolved records. All 15 geography relationships are candidates only. The five joined 2026 records retain Congress session `120`, `historicalGeoid: null`, and the current-plan evidence receipt; they do not claim a Census CD120 product, exact source-plan-to-CD119 block concordance, raw geometry equality, direct 2026 election-administration confirmation, or legal permanence.

The composition creates no independent decision: the bound identity and geography resolutions remain null. It creates zero identity approvals, geography approvals, joint approvals, evaluator values, score-eligible records, publication eligibility, or deployment.

## Reproduction

```bash
npm run generate:or-primary-joint-review-v2
npx vitest run src/ingestion/elections/oregon-primary-identity-geography-review-package-v2.test.ts --maxWorkers=1
npm run data:verify
```

The canonical artifact is `data/metadata/oregon-primary-identity-geography-review-package-v2.json`: 40,601 bytes, SHA-256 `13c7d6c0519cf1d4658a045fa37957b08fc0c288add544bcf686b86b7c446c51`, package SHA-256 `ca6c9e5dc2253e1a0ff7bc8da303d4dabed044760cb6628a6a24beb63898a5e0`, and review-record-set SHA-256 `03733a88a34ced8fdb24e90d6dca7ba18353f9355c63fac12401344a04bab661`.
