# Minnesota primary geography compatibility candidate v1

Date: 2026-08-06
Status: proposed reviewer-only candidate; not approved, score-bearing, published, or deployed

The package joins all eight Minnesota identity observations to complete official CD118 and CD119 Minnesota district-key inventories. Four 2022 rows are proposed as CD118-to-CD119 continuity candidates using the Census no-plan-change declaration and same GEOID keys. Four 2024 rows use the exact CD119 session and GEOID keys. Each retained layer closes districts 01 through 08; this target package uses MN-02 through MN-05.

All eight rows are geography candidates. The three election-source-absent observations (2022 MN-02, 2022 MN-03, and 2024 MN-03) remain identity-unresolved with null contest, result-authority, and certification fields and a not-applicable source-winner state. Geography evidence does not create an election result, candidate identity, winner, no-primary state, uncontested status, nomination, or zero.

The five reported rows preserve the Minnesota receipt's narrower authority: official-portal reported results not claimed as certified result bytes, event-level metadata without exact report bytes, and no source winner marker. The single-candidate 2024 MN-04 row does not become a winner, uncontested, or nomination inference.

The methodology explicitly records that raw TIGER geometry equality, overlap thresholds, and population equivalence were not assessed. There are no 2026 rows. All compatibility and identity approvals remain false, evaluator use is excluded, and score eligibility and publication eligibility remain false.

Artifact SHA-256: `5fa89511fb4453ff7dcfcc3684ed7af6cbb51ce12d360a98d7a54f50caedab23`
Package SHA-256: `81b0592927b90c9903ada7d65111134e00aa8e507395125e01c6f6131ceabb81`
Source-set SHA-256: `6a682ec471e01c243790214adee8812ea4f7cd242379610b227721b387fff0e3`
Parent-projection SHA-256: `a02996d76b538d2924d93fd0eaec64e9295bfe4d3e5ea1e7a8538a12c3d90100`
Row-set SHA-256: `3404b652381d8316340e18f69dbdf06538da6fa46977e35bee225e49d0cbab0b`

Recommended decision: accept the eight bounded compatibility candidates while reviewing identity and election disposition independently. Safe default: keep all eight excluded from evaluator and publication, which the package already does.

The exact six direct parents are the unresolved source-selection proposal, Minnesota result receipt, Minnesota identity candidate, Census plan-change authority, and official Minnesota CD118 and CD119 archives. Validation pins their URLs, paths, sizes, hashes, kinds, and parent lists, plus the output artifact and all package digests.

```bash
npm run generate:mn-primary-geography-compatibility-v1
npm run test:run -- src/ingestion/elections/minnesota-primary-geography-compatibility-candidate.test.ts
npm run typecheck
npm run data:verify
```
