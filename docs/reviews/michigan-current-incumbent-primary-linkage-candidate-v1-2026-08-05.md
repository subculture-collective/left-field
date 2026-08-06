# Michigan current-incumbent primary linkage candidate v1

Date: 2026-08-05
Status: proposed reviewer-only identity evidence; not approved, selected, score-bearing, published, or deployed

## Result

The candidate closes exactly 12 observations: current Michigan Democratic target districts 03, 06, 08, 11, 12, and 13 in each retained 2022 and 2024 Democratic U.S. House primary cycle. It binds the exact six-seat target roster, House Clerk MemberData, Congress Legislators Current, nationwide source-selection proposal, certified Michigan result receipt, and source-lock commitments.

| Evidence class | Rows | Boundary |
| --- | ---: | --- |
| Exact normalized relationship after reversing `LAST, FIRST` ballot order | 7 | Same-district name observation only; the Michigan source supplies no person identifier. |
| Derived middle-initial omission after ballot-order reversal | 4 | Limited to `SCHOLTEN, HILLARY` → Hillary J. Scholten and `STEVENS, HALEY` → Haley M. Stevens, each in both cycles. |
| Reported contest with no unique current-incumbent match | 1 | MI-08 in 2022 contains Daniel T. Kildee, a predecessor observation that is not linked to Kristen McDonald Rivet. |

The 11 matching rows are proposed identity links with high confidence in the name relationship. None is automatically approved. The MI-08 predecessor row remains useful contest evidence but proposes no BioGuide relationship.

## Certification, winner, and lifecycle boundaries

All 12 source contests retain Michigan Board of State Canvassers event-certification evidence and official 83-of-83-county reporting. The retained result pages do not mark winners. This package therefore does not infer a winner from vote rank, select a nominee, infer an uncontested disposition, approve identity or geography, or create evaluator values.

The August 5, 2026 observation was unofficial at 82 of 83 counties and contributes zero identity rows. A future certified 2026 package must be separately acquired after the county and state canvass boundaries. Every current row remains `identityApproved: false`, `scoreEligible: false`, reviewer-only, unpublished, and undeployed.

## Immutable identities

- Artifact: `data/metadata/michigan-current-incumbent-primary-linkage-candidate-v1.json`
- Byte size: `31,937`
- File SHA-256: `f8b790c4e37bf108e55d6c2970197801b17e6edf0b6a5656e5d1ed2ff98bd3b5`
- Parent-projection SHA-256: `54488e8a83c952ccdcf422ea1e273a482ee6e8b07d324b4eb923dd178fd4a57f`
- Observation-set SHA-256: `67128677a206a56479be0e3d58f1863ac9b9e9c99442fe0605ac6cd3394b9dcc`
- Package SHA-256: `caac838d7b33050ff2924d0aed3a9624aea0c429671536bbb40fd6b0a8463e58`

The validator pins the exact input hashes and source-lock lineage, six BioGuide/official-name identities, contest hashes and certification state, row hashes, parent projection, observation set, and package hash. It rejects parent winner fabrication, ambiguous matches, predecessor cross-linking, lifecycle escalation, missing or duplicate output retention, and fully rehashed semantic drift.

## Reproduction

```bash
npm run generate:mi-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/michigan-current-incumbent-primary-linkage-candidate.test.ts
npm run data:verify
```
