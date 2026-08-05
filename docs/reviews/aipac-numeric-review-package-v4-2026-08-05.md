# AIPAC numeric review package v4 — 2026-08-05

## Outcome

The concise queue contains four proposed decisions. The CA-31 source-precedence item has been removed because official terminal-chain evidence mechanically closed it; it is recorded separately as an automatic evidence closure with `reviewerAction: false`, not as a human approval.

| Decision class | Count | Safe default |
|---|---:|---|
| Numeric lineage and receipt methodology | 1 | Retain reviewer-only v4 |
| Labeled UDP inference policy | 1 | Retain explicit inference labels and provenance |
| Formula-v0.1 score contract | 1 | Retain 60/25/15 weights and the six-cell denominator |
| Publication promotion | 1 | Defer and keep artifacts out of the public release |

The promotion recommendation now depends on the three methodology decisions. It still requires a distinct approved release after explicit reviewer action; this package does not promote, deploy, publish, or alter the current public release.

## Reproduction and hashes

```bash
npm run generate:aipac-numeric-review-v4
npm run test:run -- src/ingestion/fec/aipac-numeric-review-package-v4.test.ts
npm run typecheck
npm run data:verify
```

- Artifact: `data/metadata/aipac-numeric-review-package-v4.json`
- Artifact SHA-256: `f47e499ac4aa3973ee186b87c46627495348684167ecc16927e0934cfd169d36`
- Decision-set SHA-256: `d7b31a8345e75e669fe12ded18289c678081ee51593622427dbab3bf6919a942`
- Package SHA-256: `6fcef33a2cd0e6a744b62ae6ed12050107dbc8fc5ba9239644b1ecd1206e3110`
- Status: proposed; reviewer, reviewed-at, and all decision resolutions are null; publication eligible: false.
