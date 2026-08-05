# AIPAC numeric evidence candidate v4 — 2026-08-05

## Outcome

Numeric v4 replays the unchanged August 4 source closure and byte-pinned PAS2 archives through foundation v4. It changes only CA-31's two 2024 channel cells from pending to complete-zero under the source-locked terminal-chain disposition.

| Metric | Numeric v3 | Numeric v4 | Change |
|---|---:|---:|---:|
| Complete seats | 211 | 212 | +1 |
| Partially pending seats | 1 | 0 | -1 |
| Evidence groups | 278 | 278 | unchanged |
| Direct / UDP groups | 259 / 19 | 259 / 19 | unchanged |
| Matching / complete-zero cells | 273 / 993 | 273 / 995 | +2 complete-zero |
| Blocked / not-applicable cells | 2 / 4 | 0 / 4 | -2 blocked |

CA-31 now has all six cells complete, including 2024 direct AIPAC PAC and UDP outcomes bound to the new foundation relationship/disposition hashes. Neither 2024 channel contains a qualifying transaction, so the seat emits zero evidence groups. Unavailable was not converted to zero: completion comes from the proven relationship plus exhaustive, already frozen transaction sources. MA-06 and NH-01 retain four 2026 `not_applicable_no_house_candidacy` cells.

## Reproduction and hashes

```bash
npm run generate:aipac-numeric-evidence-v4
npm run test:run -- src/ingestion/fec/aipac-numeric-evidence-candidate-v4.test.ts
npm run typecheck
npm run data:verify
```

- Artifact: `data/metadata/aipac-numeric-evidence-candidate-v4.json`
- Artifact SHA-256: `4aae1342be0439f510f44bdb0b1d5d73066e6823599a186ab066cf7495eb9099`
- Package SHA-256: `7dd647ac1937b2104aef91db249e9afa72867464035560590823ec57c08b8c28`
- Seat-set SHA-256: `d8ef1e5005e7674a49ffa34c79b2794595df51553f911cd0c42f370cb0470f7c`
- Evidence-set SHA-256: `11f2e56dd9d0371311632c00753b9dc9c87f64bdd8d6f6623b14e8ffe42d6fc4`

The artifact is reviewer-only, nonpublishable, and retains no donor identities or address-bearing source rows.
