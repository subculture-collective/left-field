# AIPAC numeric evidence candidate v3 — 2026-08-05

## Outcome

Numeric v3 replays the unchanged August 4 FEC closure, source receipts, production projection, incumbent roster, and three byte-pinned PAS2 archives through evidence foundation v3. It replaces numeric v2's six-seat blanket block with the exact cycle dispositions already established from locked official evidence. It remains reviewer-only, is not publication eligible, and is not connected to the public application.

| Metric | Numeric v2 | Numeric v3 | Change |
|---|---:|---:|---:|
| Complete seats | 206 | 211 | +5 |
| Partially pending seats | 0 | 1 | +1 |
| Evidence groups | 274 | 278 | +4 |
| Direct AIPAC PAC groups | 256 | 259 | +3 |
| Independent UDP groups | 18 | 19 | +1 |
| Seats with evidence | 124 | 127 | +3 |
| Blocked coverage cells | 36 | 2 | -34 |
| Not-applicable coverage cells | 0 | 4 | +4 |

The exact 1,272-cell result is 273 `complete_matching_evidence`, 993 `complete_no_matching_evidence`, two `blocked_pending_mapping`, and four `not_applicable_no_house_candidacy` cells.

## Six incumbent dispositions

| Seat | Numeric-v3 result |
|---|---|
| CA-31 | Only the two 2024 channel cells remain blocked pending source precedence. Its independently exact 2026 relationship is usable, its other cycles close without a matching group, and no numeric evidence group is emitted. |
| MA-06 | The 2024 direct relationship yields one $5,000 AIPAC PAC group. Both 2026 cells are not applicable because there is no House candidacy; they are never zero. |
| MD-04 | The effective incumbent ID is corrected to `H2MD04232`. Lifting the unrelated incumbent block exposes an already valid 2022 UDP opposition-to-challenger group totaling $4,258,735.79. |
| MN-03 | The exact cycle-scoped relationship closes all six cells without a matching group. Raw `DFL` remains preserved and Democratic affiliation remains a sourced derivation in the bound foundation disposition. |
| NH-01 | Direct AIPAC PAC groups total $2,100 for 2022 and $10,003 for 2024. Both 2026 cells are not applicable because there is no House candidacy; they are never zero. |
| NY-04 | The effective incumbent ID is corrected to `H2NY04244`; all six cells close without a matching group and no earlier committee relationship is backfilled. |

Coverage records bind the foundation-v3 relationship hash and, for resolved incumbent relationships, the exact disposition hash. Corrected effective IDs are used only for the permitted cycles; the original stale IDs and aliases remain in the immutable source relationship for audit. The existing California 47 invalid-origin rejection and both independently valid Illinois 7 UDP groups remain unchanged.

## Integrity and privacy

Every retained group still uses the cutoff-valid terminal filing, latest transaction revision, signed-net-positive grouping, and transaction receipt rules from numeric v2. Validation checks the exact parent bytes, package and set hashes, six unique coverage cells per seat, evidence-to-receipt identity, transaction/source-record uniqueness, corroboration cardinality, the affected-seat matrix, and the sole pending and not-applicable universes. Donor names, addresses, employers, occupations, and filing free text are not retained.

## Reproduction

The generator requires the three exact PAS2 ZIPs under `DSA_SEATS_AIPAC_PAS2_DIR` or `/tmp/dsa-aipac-evidence-20260804`.

```bash
npm run generate:aipac-numeric-evidence-v3
npm run test:run -- src/ingestion/fec/aipac-numeric-evidence-candidate-v3.test.ts
npm run typecheck
npm run data:verify
```

Artifact: `data/metadata/aipac-numeric-evidence-candidate-v3.json`

- Artifact SHA-256: `a2bf17ef05d02b4f35a9bcc5d9da602be14706068e1c5e6f0f8311bf5deb96e0`
- Package SHA-256: `e30956852e24f9cdd9a95f8d978b3c3bdbd5978eae293f6e5aa5c0d57f04eeb8`
- Seat-set SHA-256: `61af3ac2f8b765a04284aefd08d53d185583985870e2f0c9085bb854931645df`
- Evidence-set SHA-256: `f328eb0cb02d3452526d04e723c6d833c4732fb38eea1e36b90911aa88b5ca9b`

Numeric v2 remains immutable. Numeric v3 does not approve a methodology or release, and it does not change any published score or public route. Additive report v5 consumes it under the unchanged formula-v0.1 scoring firewall.
