# New Mexico current-incumbent primary identity candidate v1 — 2026-08-07

## Outcome

This reviewer-only candidate binds all nine retained NM-01, NM-02, and NM-03 district-cycle observations to the current roster identities. It proposes three exact normalized relationships for Teresa Leger Fernandez and six documented derived relationships for Melanie Stansbury and Gabe Vasquez. The nine linked candidate rows contain 433,665 votes.

Every relationship is proposed and high confidence, but none is approved, selected, score-eligible, published, or deployed. Historical geography remains a separate unapproved candidate; same-number district observations do not approve compatibility.

## Evidence classes

- `MELANIE ANN STANSBURY` is derived rather than exact against Clerk official `Melanie A. Stansbury`. Congress Legislators explicitly retains middle name `Ann`, so this is a documented full-middle-name relationship rather than an arbitrary expansion of `A.`.
- `GABRIEL VASQUEZ` is derived rather than exact against Clerk official `Gabe Vasquez`. Congress Legislators explicitly retains first field `Gabriel (Gabe)` and official full `Gabe Vasquez`; no generic nickname table is used.
- `TERESA LEGER FERNANDEZ` normalizes exactly to both current official authorities. The compound surname is retained intact.

New Mexico source candidate IDs identify candidates inside the state result exports. No retained mapping connects them to Bioguide, so all nine rows retain `directIdentifierBridgeAvailable: false`.

## Result and lifecycle boundary

All observations inherit `secretary_official_federal_results_export_retained` and `sourceWinnerStatus: not_marked_by_source`. The 2022 archive/no-separate-certificate status remains distinct from the 2024/2026 statewide canvass-announcement status. Vote rank, 100% share, and one-candidate contests create no winner or nomination conclusion.

Identity linkage creates no geography approval, source winner, nomination, selection, evaluator value, score, reviewer resolution, publication, or deployment state.

## Provenance and pins

The exact direct parents are the target roster, source-selection proposal, House Clerk XML, Congress Legislators snapshot, and New Mexico results receipt. Raw CSVs remain transitive receipt inputs.

- artifact bytes: `25591`
- file SHA-256: `3168dd12c54063af9e6108f64933ec35fd87dbae84afdcaa8c729e4960115e36`
- package SHA-256: `d80ff1b59482b020643a6215aecdfca733b4b52ddb21c3d419ff2d0ea3ab1adf`
- observation-set SHA-256: `ad2d5c14d05a4ad3d569341ee9d9ae00e24fd44f0adf604dbe1c6dbd13dd08b1`

## Reproduction

```bash
npm run generate:nm-current-incumbent-primary-linkage-v1
npx vitest run src/ingestion/elections/new-mexico-current-incumbent-primary-linkage-candidate.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The generator is create-only and byte-deterministic. Tests reject source-lock drift and fully rehashed identity approval, winner inference, and publication escalation.
