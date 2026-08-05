# AIPAC numeric evidence candidate v2 — 2026-08-05

## Outcome

Numeric v2 replays the exact August 4 filing closure, source receipts, production projection, roster, and three byte-pinned PAS2 archives through foundation v2. It remains reviewer-only, nonpublication-eligible candidate evidence and is not connected to the public application or an evaluator report.

| Metric | v1 | v2 | Change |
|---|---:|---:|---:|
| Complete seats | 204 | 206 | +2 |
| Pending/blocked seats | 8 | 6 | -2 |
| Evidence groups | 272 | 274 | +2 |
| Direct AIPAC PAC groups | 256 | 256 | 0 |
| Independent UDP groups | 16 | 18 | +2 |
| Seats with evidence | 123 | 124 | +1 |
| Coverage cells | 1,272 | 1,272 | 0 |

Illinois 7 is now complete. The accepted `H0IL07167` relationship produces one net-positive 2024 `independent_oppose_challenger` group of $487,329.29. The independently valid `H6IL07339` relationship produces one 2026 group of $59,748.29. The source contains many transaction receipts, but the numeric contract emits one signed-net relationship/cycle/channel group.

California 47 is also complete. The rejected `H0IL07167` relationship is never used as an evidence origin, while separately valid incumbent and challenger relationships close the applicable association scope. None produces a directionally qualifying net-positive group, so all six cells are `complete_no_matching_evidence`. The seat retains the rejected disposition hash as diagnostic provenance; it is not silently erased.

## False-zero firewall

The six incumbent-resolution seats—CA-31, MA-06, MD-04, MN-03, NH-01, and NY-04—remain `blocked_pending_mapping`. Every one of their six coverage cells is blocked, and their evidence and receipt arrays are empty. Proposed corrected IDs, committees, aliases, and cycle changes never enter numeric selection.

MA-06 and NH-01 retain `proposedNoHouseCandidacyCycles: [2026]`. That is proposal context, not an accepted not-applicable state. Their 2026 cells remain blocked and cannot become zero or an approved House-cycle exclusion until authorized review.

Each completed coverage cell records the exact source snapshots, source artifact hashes, basis relationship hashes, and qualifying evidence count. A complete zero requires a closed source scope with no pending mapping and no uncovered invalid origin. Every emitted evaluator row retains its transaction-level receipt linkage and cutoff-valid terminal-revision selection rule.

## Reproduction

The generator requires the three exact PAS2 ZIPs under `DSA_SEATS_AIPAC_PAS2_DIR` or `/tmp/dsa-aipac-evidence-20260804` and verifies their byte hashes before parsing.

```bash
npm run generate:aipac-numeric-evidence-v2
npm run test:run -- src/ingestion/fec/aipac-numeric-evidence-candidate-v2.test.ts
npm run typecheck
npm run data:verify
```

Artifact: `data/metadata/aipac-numeric-evidence-candidate-v2.json`

Numeric v2 changes no published release, public route, score, rank, or reviewer decision. Report v4 must consume it as a separate candidate and preserve null AIPAC scoring for every noncomplete seat.
