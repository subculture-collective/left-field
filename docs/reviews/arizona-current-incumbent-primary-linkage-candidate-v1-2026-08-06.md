# Arizona current-incumbent primary linkage candidate v1

Date: 2026-08-06  
Status: proposed reviewer-only identity evidence; not approved, selected, score-bearing, published, or deployed

## Result

The candidate closes exactly six observations: current Arizona Democratic target districts 03, 04, and 07 in each retained 2022 and 2024 Democratic U.S. House primary cycle. It binds the exact three-seat target roster, House Clerk MemberData, Congress Legislators Current, nationwide source-selection proposal, certified Arizona result receipt, and source-lock commitments.

| Evidence class | Rows | Boundary |
| --- | ---: | --- |
| Exact normalized official-name relationship | 3 | Yassamin Ansari in 2024 district 03 and Greg Stanton in both district 04 cycles; the result source supplies no person identifier. |
| Reported contest with no unique current-incumbent match | 3 | Ruben Gallego in 2022 district 03 and Raúl/Raúl M. Grijalva in district 07 are predecessor observations, not links to Yassamin Ansari or Adelita S. Grijalva. |

The three matching rows are proposed identity links with high confidence in the same-district exact-name relationship. None is automatically approved. The three predecessor rows remain useful contest evidence but propose no BioGuide relationship.

The target contests contain eight named candidate rows and 318,970 named-candidate votes. The final 2024 district 03 recount also retains a separate 93-vote aggregate write-in channel.

## Certification, source-winner, and lifecycle boundaries

All six source contests retain certified statewide-canvass authority. The 2024 district 03 observation retains the final recount and court-order authority that supersedes its initial canvass. Source winner markers remain direct source facts only: this package does not convert them into identity evidence, review approval, evaluator selection, or progressive classification.

The August 5, 2026 source boundary contributes zero identity rows because the available results were unofficial before the scheduled statewide canvass. Every current row remains `identityApproved: false`, `scoreEligible: false`, reviewer-only, unpublished, and undeployed.

## Immutable identities

- Artifact: `data/metadata/arizona-current-incumbent-primary-linkage-candidate-v1.json`
- Byte size: `16,580`
- File SHA-256: `3ef6f3a9e8d63e74fc20086101e838fce02b177ee1b5fdf53220b26c396350fd`
- Parent-projection SHA-256: `0d0c367a09739bade8e5677ce47ba4144dd5b78f7d730dc52c1983f8b3483ba8`
- Observation-set SHA-256: `e4bac18f0961d7fad61e7a90cfa9e8e2f7d7b64022a2898709b6c1a778a01913`
- Package SHA-256: `ba49c03b31206990f5427df19aa60daad3bc4ee05d2fbc92695cb939c1c29ea9`

The validator pins the exact input hashes and source-lock lineage, three BioGuide/official-name identities, contest hashes and authority/revision states, row hashes, parent projection, observation set, and package hash. It rejects source-winner fabrication, ambiguous matches, predecessor cross-linking, lifecycle escalation, missing or duplicate output retention, and fully rehashed semantic drift.

## Reproduction

```bash
npm run generate:az-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/arizona-current-incumbent-primary-linkage-candidate.test.ts
npm run data:verify
```
