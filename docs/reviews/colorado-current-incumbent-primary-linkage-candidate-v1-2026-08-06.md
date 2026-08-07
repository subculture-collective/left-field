# Colorado current-incumbent primary linkage candidate v1

Date: 2026-08-06
Status: proposed reviewer-only identity candidate; not approved, score-bearing, published, or deployed

## Result

The package proposes 12 exact normalized same-district name relationships for the four current Colorado target seats across the completed 2022, 2024, and 2026 Democratic U.S. House primaries:

- CO-01: Diana DeGette
- CO-02: Joe Neguse
- CO-06: Jason Crow
- CO-07: Brittany Pettersen

Each source name matches the current official House name in the same district. The roster BioGuide identity is independently corroborated against the retained House Clerk MemberData and Congress Legislators records. The election-result rows contain no direct person/BioGuide identifier bridge, so every relationship remains a proposed exact-name observation rather than an automatic approval.

The 12 target contests contain 1,120,718 total votes. The proposed current-incumbent source rows contain 1,007,185 votes: 303,755 in 2022, 296,655 in 2024, and 406,775 in 2026. These are retained source facts, not evaluator values or a vote-rank winner inference.

The package preserves the cycle-specific authority boundaries:

- 2022: official Secretary abstract, with the certification announcement and signed statewide abstract retained.
- 2024: official certified Biennial Abstract, without a separately retained signed certificate.
- 2026: signed Secretary statewide abstract with the signed certificate bound to the abstract.

Every source contest remains `not_marked_by_source` for winner status. The package does not infer a winner, nominee, uncontested status, identity approval, selection, historical geography compatibility, evaluator value, or score. All 12 observations are identity-unapproved, geography-unapproved, evaluator-excluded, score-ineligible, reviewer-only, publication-ineligible, and undeployed.

Artifact SHA-256: `ece5bc2b4938fb8ef2c1d9716e7b0ce19057e7f9671fb4eaa4ec6304f4b5d04a`
Package SHA-256: `6d89eb3cfeba6da05abafd4daf710fea55d282291c19ea10b83abc2a1b4e6649`
Observation-set SHA-256: `2fe869fd9b90f549e47c0916eb02c4b9644584ecf4d95a4711015d570e056e9e`

Recommended identity decision: accept the 12 exact same-district name observations as identity candidates while retaining all downstream gates. Safe default: keep every observation excluded from evaluator and publication, which the package already does.

The exact five direct parents are the incumbent roster, source-selection proposal, House Clerk MemberData, Congress Legislators current file, and Colorado result receipt. Validation pins their URLs, paths, sizes, hashes, kinds, and ordered parent lists, plus the output artifact and semantic package digests.

## Geography boundary

No geography conclusion is made here. The current CD119 Colorado TIGER archive is retained, but the official CD118 Colorado archive is not yet source-locked. It must be acquired and validated before any 2022-to-CD119 continuity candidate is proposed. The completed 2026 primaries elect the 120th Congress; CD120 compatibility must remain unassessed unless separate exact authority is retained.

## Reproduction

```bash
npm run generate:co-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/colorado-current-incumbent-primary-linkage-candidate.test.ts
npm run typecheck
npm run data:verify
```
