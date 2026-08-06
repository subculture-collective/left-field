# Illinois current-incumbent primary linkage candidate — 2026-08-05

## Status

This is a deterministic reviewer-only identity candidate. It proposes candidate-to-current-incumbent relationships for the 14 Illinois Democratic House seats in the production target roster across the retained 2022 and 2024 primary-result cycles. It approves no relationship, supplies no evaluator value, changes no public release, and is not deployed.

## Exact closure

- The target denominator is exactly districts `01`–`11`, `13`, `14`, and `17`: 14 current roster seats and 28 seat-cycle observations.
- Twenty observations match the normalized official House Clerk name exactly within the same district and cycle.
- Eight are bounded same-district derived relationships: Robin L. Kelly → `ROBIN KELLY`, Delia C. Ramirez → `DELIA RAMIREZ`, Jesús G. "Chuy" García → `JESUS "CHUY" GARCIA`, and Bradley Scott Schneider → `BRAD SCHNEIDER`, each in both cycles.
- Candidate rows marked as write-ins are excluded before identity matching. Every target contest must produce exactly one non-write-in match under its frozen match method.
- The Illinois exports contain no direct candidate-to-BioGuide identifier. All 28 relationships remain proposed and reviewable.
- Districts 12, 15, and 16 remain in the all-district result receipt but are outside this current-target identity denominator. No 2026 result or linkage row is emitted.

## Independent unresolved boundaries

The Illinois State Board exports remain official-result candidates without a separately retained final statewide canvass or certification artifact. The artifact serializes the receipt's exact four inherited unresolved gates: final canvass/certification, incumbent-candidate identity, historical geography, and progressive classification. Every identity observation preserves `certificationStatus: not_retained`, and both top-level and row-level evaluator exclusion explicitly require all four gates. Human review, scoring, promotion, publication, and deployment remain separate. Missing certification is not converted into a negative result, and identity evidence does not approve geography or publication.

## Integrity

The generator binds the exact roster, source-selection proposal, House Clerk XML, congress-legislators snapshot, and Illinois result receipt bytes and source-lock lineages. Each selected row retains the Illinois authority-scoped candidate ID while explicitly declining to treat it as a BioGuide bridge. The generator pins a projection of every copied contest, candidate, roster, certification, and match fact, rejects ambiguous matches and source-lock drift, and validates the output artifact's own exact source-lock lineage.

- File SHA-256: `d9f46120064cd293cb63876866c5fa261c142f621d3e1c0662d7dd8dfcd27e25`
- Parent-projection SHA-256: `b440700524ebc445ef04c5884278ef9a615c3cf31b1229dc52a10b6a863da436`
- Observation-set SHA-256: `5d72e4bda79491d4e1a430148fa2ecd5cfd22f83cd5de80e6b7f75439f7fed34`
- Package SHA-256: `f678f9bd0b65f20bba40c4e9c0620fbcfdcd159fc989597a7dd1cc0e6288980e`

## Reproduction

```bash
npm run generate:il-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/illinois-house-democratic-primary-results-receipt.test.ts src/ingestion/elections/illinois-current-incumbent-primary-linkage-candidate.test.ts
npm run data:verify
npm run typecheck
```
