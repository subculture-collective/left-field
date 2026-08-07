# Minnesota current-incumbent primary identity candidate v1

Date: 2026-08-06
Status: proposed reviewer-only candidate; not approved, selected, score-bearing, published, or deployed

## Result

This candidate closes the eight-row matrix formed by the four current Minnesota Democratic target seats (MN-02 through MN-05) and the retained 2022 and 2024 state-primary cycles. It binds the exact production target roster, unresolved primary-source proposal, House Clerk and Congress Legislators current identity files, Minnesota result receipt, and their source-lock lineage.

Five same-district exact-name relationships are proposed and none is approved:

| Cycle and district | Current identity | Retained source candidate | Votes | Contest votes |
|---|---|---|---:|---:|
| 2022 MN-04 | Betty McCollum (`M001143`) | Betty McCollum (`01070403`) | 58,043 | 69,597 |
| 2022 MN-05 | Ilhan Omar (`O000173`) | Ilhan Omar (`01080405`) | 57,683 | 114,567 |
| 2024 MN-02 | Angie Craig (`C001119`) | Angie Craig (`01050401`) | 26,865 | 29,514 |
| 2024 MN-04 | Betty McCollum (`M001143`) | Betty McCollum (`01070401`) | 37,530 | 37,530 |
| 2024 MN-05 | Ilhan Omar (`O000173`) | Ilhan Omar (`01080401`) | 67,926 | 120,801 |

The five reported contests contain 15 candidate rows and 372,009 votes. The source candidate identifiers are election-result row identifiers, not direct person/BioGuide bridges. The candidate therefore records exact normalized official-name observations with high confidence but keeps every relationship proposed and independently reviewable.

The other three observations—2022 MN-02, 2022 MN-03, and 2024 MN-03—have no district contest in the retained source corpus. Their contest, candidate, count, vote, match, evidence, confidence, authority, and winner fields remain null. Source absence does not become zero votes, no primary, uncontested status, nomination, or a predecessor/current-incumbent substitution.

Artifact: `data/metadata/minnesota-current-incumbent-primary-linkage-candidate-v1.json`
Artifact SHA-256: `fd010c1e43a61f6973154e0bf1ffb0e7259c089cea56700158387888a54dd234`
Package SHA-256: `77baabd12581f1880c811dc75ab77a79481ca9a5388a920f5ca30cc85b0c3a61`
Observation-set SHA-256: `77f4eb4b2c3ff31d9e861c25a4e9eb66560f90860246f53c48a0afda23ac747c`

## Authority boundary

The package preserves Minnesota's raw `DFL` party code. The retained Secretary of State flat files are described as portal-reported results and do not mark a winner. Event-level canvass document metadata is retained, but the exact canvass report bytes are not; no candidate-by-candidate certification is claimed. Vote order, vote share, and the one-candidate 2024 MN-04 row therefore do not establish a source winner, uncontested disposition, or nomination.

The 2026 primary is scheduled but has not occurred and contributes zero rows. A later result requires a separately versioned receipt and candidate.

## Review decision and safe default

Recommended decision: accept the five exact same-district name relationships as identity links, while preserving the three source absences as unresolved and reviewing historical geography separately.

Safe default: keep all eight observations excluded from the evaluator and public release. Choosing differently changes only the proposed identity relationships; it does not authorize a disposition, historical-geography mapping, candidate classification, score, or publication.

The artifact applies that default. Reviewer identity, review time, and resolution are null. Every row has `identityApproved: false`, `selectionStatus: unselected`, and `scoreEligible: false`; `publicationEligible` is false.

## Integrity and reproduction

The validator pins the five immutable parent files and their exact source-lock topology, current seat/BioGuide/district/name closure, all eight observation keys, copied contest and candidate facts, null absence semantics, raw party and source-authority boundaries, lifecycle fields, row hashes, observation-set hash, package hash, and the output artifact's bytes and lineage. Adversarial tests reject fully rehashed approval fabrication and source-candidate drift.

```bash
npm run generate:mn-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/minnesota-current-incumbent-primary-linkage-candidate.test.ts
npm run typecheck
npm run data:verify
```

The next independent package is the Minnesota historical-geography compatibility candidate. This identity artifact makes no historical-to-current district compatibility claim.
