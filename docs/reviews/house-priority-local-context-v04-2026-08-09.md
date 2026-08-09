# House Priority Index local-context activation v0.4 — 2026-08-09

The public House Priority Index now uses retained county context where the county-to-seat geography closes without allocation. Version 0.4 activates the previously generated shadow calculation through a separate immutable projection; it does not rewrite the shadow receipt or relax its source boundaries.

## Active scope

- 430 occupied regular Democratic or Republican voting House seats remain ranked.
- DE-AL moves from 39.3 to 39.5 (rank 200 to 199).
- SD-AL moves from 0.0 to 7.2 (rank 429 to 361).
- WY-AL moves from 6.6 to 14.5 (rank 371 to 314).
- The other 427 seats retain their v0.3 score exactly.
- Party route, incumbent identity, and qualifying-route classifications do not change.

The three active rows use complete at-large CD119 county universes. No split county is allocated, and the MEDSL county House research projections do not enter the active score.

## Formula boundary

Local context is an available-weight blend of:

```text
0.40 inverse ballots cast / CVAP
0.30 inverse active registration / CVAP
0.20 down-ballot Democratic overperformance
0.10 demographic opportunity
```

The down-ballot component remains unavailable. The remaining 80% is renormalized only because a direct election-administration measure exists and at least 60% of the component is available. Demographic opportunity is `0.35 renter + 0.25 age 18–34 + 0.25 inverse income + 0.15 density`, using within-state midrank percentiles and county population weights.

For an eligible Democratic seat, local context replaces 20% of the structural baseline before alignment and cash are applied. For an eligible Republican seat, the pre-cap route is `0.60 competitiveness + 0.20 cash vulnerability + 0.20 local context`; the existing 70% route cap remains.

## Provenance

- Parent shadow artifact: `data/metadata/house-score-v04-shadow-projection-v1.json`, SHA-256 `9f11120f810c8eebb5f1c13e069113e3cbfa965c5db4930f89ba698f13dbc80b`.
- Active projection: `data/metadata/house-score-v04-active-projection-v1.json`, 272,726 bytes, SHA-256 `8bd0a866867330a16f4fd2e5e1eea37d7a06f0650671e55831317ceb9941cc80`.
- Active row set: `6ea048a3f259855ea94bbdb0b4682965152ef612f01eb9a24061305cfc4529c1`.
- Active package: `890685b51d73bc146e727ee21d2bd4d94c52a0686a0651c9d33ede54a0c868f0`.

The activation projection records the product-owner direction to use retained county context. It is an implemented scoring policy, not a fabricated external review signature or a claim that broader county-election research has been promoted.

## Reproduction and checks

```bash
npm run generate:house-score-v04-shadow
npm run generate:house-score-v04-active
npx vitest run src/lib/house-priority-index.test.ts \
  src/rapid-acquisition/house-score-v04-shadow.test.ts \
  src/rapid-acquisition/house-score-v04-active.test.ts \
  src/ui/rapid-expansion-status.test.ts
npm run typecheck
npm run data:verify
npm run build
```
