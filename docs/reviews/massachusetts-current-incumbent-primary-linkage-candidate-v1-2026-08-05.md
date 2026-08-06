# Massachusetts current-incumbent primary linkage candidate v1

Date: 2026-08-05
Status: proposed reviewer-only identity evidence; not approved, selected, score-bearing, published, or deployed

## Result

The candidate closes exactly 18 observations: Massachusetts districts 01–09 in each of the completed 2022 and 2024 Democratic U.S. House primary cycles. It binds the exact nine-seat target roster, House Clerk MemberData, Congress Legislators Current, nationwide source-selection proposal, Massachusetts PD43+ receipt, and source-lock commitments.

| Evidence class | Rows | Boundary |
| --- | ---: | --- |
| Exact normalized official House name in the same district | 10 | Direct name observation only; no person identifier appears in PD43+. |
| Derived retained same-district name relationship | 8 | Limited to `Lori Loureiro Trahan`, `Seth W. Moulton`, `Ayanna S. Pressley`, and the retained public alias `Bill Keating`, each in both cycles. |

All 18 rows are proposed identity links with high confidence in the name relationship. None is automatically approved. The PD43 `sourceRecordId` identifies a contest result, not a person. The portal winner marker remains a source observation and does not establish a BioGuide bridge, identity approval, nomination, selection, evaluator value, or publication authority.

## Lifecycle and disposition boundaries

The source receipt reports one named candidate plus separate `All Others` and blank-vote channels in every contest. This package preserves `reported_single_named_candidate_not_uncontested_inference`; it does not convert those records into uncontested-primary dispositions or numeric primary margins.

The package binds but does not resolve `approve-historic-primary-candidate-identity-resolution-v1` and `decide-nonstandard-primary-disposition-treatment-v1`. Historical geography remains a separate unapproved candidate. The September 1, 2026 primary was scheduled after the August 5 cutoff, so this identity package contains zero 2026 observations. Every row has `identityApproved: false`, `scoreEligible: false`, and evaluator use excluded pending authorized identity and historical-geography review.

## Immutable identities

- Artifact: `data/metadata/massachusetts-current-incumbent-primary-linkage-candidate-v1.json`
- Byte size: `31,549`
- File SHA-256: `71566ac5dd105b846f6977ad3269d0419ff8df954cf36775864873b324bbe3a5`
- Observation-set SHA-256: `6d2989f28b08974243a984bac3e3c71a23f597825e6c30f6c6a73dbbcb5c076b`
- Package SHA-256: `364d4e42d293c5b81408f9b71daa90d2d7ed21c96119e92a82dcd631f1590e3d`

The validator pins the exact 18 contest IDs, contest hashes, source names, named-candidate votes, nine BioGuide/official-name identities, match methods, row hashes, observation-set hash, and package hash. It rejects unknown fields, missing or duplicate rows, parent/source-lock drift, lifecycle changes, candidate or vote substitution, and fully rehashed semantic drift.

## Reproduction

```bash
npm run generate:ma-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/massachusetts-current-incumbent-primary-linkage-candidate.test.ts
npm run data:verify
```
