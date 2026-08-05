# DSA target evaluation review report v6 — 2026-08-05

## Outcome

Report v6 recomputes formula `dsa-primary-target-v0.1` from numeric v4. CA-31 becomes evaluator-complete with six-cell coverage and an AIPAC component of zero because no qualifying evidence matched. Its selected route and target score remain null, so no unsupported ranking is created.

| Metric | Report v5 | Report v6 | Change |
|---|---:|---:|---:|
| Numeric-complete candidate seats | 211 | 212 | +1 |
| Evaluator-complete AIPAC seats | 201 | 202 | +1 |
| Pending mapping seats | 1 | 0 | -1 |
| Evidence groups used | 261 | 261 | unchanged |
| AIPAC route selections | 52 | 52 | unchanged |
| Partial qualified / not qualified | 140 / 72 | 140 / 72 | unchanged |

The unchanged denominator firewall keeps MA-06 and NH-01 AIPAC-score-ineligible because their 2026 House cycle is not applicable. The eight Washington top-two seats remain formula-incompatible. A component of zero is emitted only for a fully complete matrix; pending, not-applicable, and formula-incompatible states still produce null components.

## Reproduction and hashes

```bash
npm run generate:dsa-target-review-v6
npm run test:run -- src/domain/dsa-target-review-report-v6.test.ts
npm run typecheck
npm run data:verify
```

- Artifact: `data/metadata/dsa-target-evaluation-review-report-20260805-v6.json`
- Artifact SHA-256: `cdce153e52cbfbcee669c64a6671b4d52cb11728f04c8a7bb2092c96b0063401`
- Report SHA-256: `9df5ab4cb08556aac9a5ff87aa33d8bdf2aeed3a374b9c7d46fdc60e1d7965b7`
- Review status: proposed; reviewer and reviewed-at fields are null; publication eligible: false.
