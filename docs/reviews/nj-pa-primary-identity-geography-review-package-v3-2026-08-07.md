# NJ/PA primary identity/geography review package v3

Date: 2026-08-07
Status: proposed reviewer queue; not approved, score-bearing, published, or deployed

## Result

This immutable composition preserves all 41 NJ/PA joint-v2 records and attaches the retained certification-availability assessment strictly by state and cycle. It covers 27 New Jersey records across 2022, 2024, and 2026 and 14 Pennsylvania records across 2022 and 2024. The parent partition remains 33 records with both identity and geography candidates and eight geography-candidate/identity-unresolved records.

Every record preserves its parent identity, geography, contest hash, seat, cycle, district, category, and exclusion state. The added projection records which official result artifact and certification context were retained for that state-cycle. It does not claim that any exact result artifact was reconciled to a certification instrument.

The evidence boundary remains narrow:

- New Jersey's three official result lists are result candidates, not substitutes for the separately required post-canvass Secretary certificate.
- Pennsylvania 2024 has retained statewide certification context, but the announcement does not identify or hash-bind the exact retained precinct extract.
- Pennsylvania 2022 has no retained cycle-certification authority, and districts 13–15 remain unresolved rather than becoming zero, uncontested, or no-primary facts.
- Pennsylvania 2026 remains package-level assessment context only. Its certification statement does not create a result receipt, contest, candidate, vote, or joint row.

All 41 record projections keep `exactResultCertificationReconciled: false`, `authorityApproved: false`, and `scoreEligible: false`. The package preserves the two existing identity/geography decision reviews and adds one inherited review of `collect-official-state-primary-results-and-certification-v1`. It creates no independent decision; all parent and proposed resolutions, reviewer identities, and timestamps remain null.

Every identity, geography, and joint approval remains false. Evaluator use stays excluded, publication eligibility is false, and no deployment is authorized.

Artifact SHA-256: `fadb205f2749aad2ef8de6984d0d8e515743fc335359f23bde7d34ebdee8a4cb`
Package SHA-256: `5b83a62806ccbefe2993812f46006b0848aca983d507250b5331bcdc7c0400fb`
Review-record-set SHA-256: `71c1dd05e24b0ca6eab339720f58b0b93c915d90ce3ddfb29c7d55b88ee0e2be`
Authority-projection-set SHA-256: `cab363d2a2be192cac12fb0706bbe0fcf28537e6eee9a7951d114590c6714a92`
Parent-review-set SHA-256: `0c20132c804063e93e50c86ceb0f334e8ad85c4b630a4ec3365e121ef8dd6493`

The source-locked output has exactly two ordered direct parents: joint v2 and the certification-availability assessment. Result receipts, statutes, certification statements, identity evidence, Census layers, and geography authority remain inherited through those exact parent graphs.

## Reproduction

```bash
npm run generate:nj-pa-primary-joint-review-v3
npm run test:run -- src/ingestion/elections/nj-pa-primary-identity-geography-review-package-v3.test.ts
npm run typecheck
npm run data:verify
```
