# Texas primary geography compatibility candidate v1

Date: 2026-08-05

Status: proposed reviewer-only geography evidence; not approved, score-bearing, published, or deployed

## Outcome

The candidate closes the exact 78-row Texas current-target election-event universe inherited from the identity-event package:

- 39 regular-primary and 39 runoff observations across 2022, 2024, and 2026;
- 44 reported-contest observations and 34 source-unobserved district-events;
- 26 proposed CD118-to-CD119 plan-continuity relationships for 2022;
- 26 proposed exact CD119 same-session and state-district-key relationships for 2024;
- 26 CD120 and Texas 2026 plan-crosswalk rows retained as authority-pending;
- 52 compatibility candidates and 26 authority-pending rows; and
- zero automatic approvals, evaluator values, or score-eligible rows.

Artifact: `data/metadata/texas-primary-geography-compatibility-candidate-v1.json`

Artifact byte size: `138039`

Artifact SHA-256: `66ee61783980ebca966a6d9c70abba9cc2d2616ae91129870d3d398a90026ed8`

Package SHA-256: `cc4aad571b826b10176846e7571bf598eebc245f8f88ef02626c5d50d0fd9335`

Row-set SHA-256: `d8b06725f87143c95e7ce24debcca3d51353f51097c06b61283cd75a54d445c4`

Parent-projection SHA-256: `68fef20bd2b16f688f1d5bc0203992ddf07ece12b7ad9a24572ca59e8863f7d3`

## Exact event and session partition

The row grain is one current target district and election event. Regular primaries and runoffs remain separate, even when both refer to the same district and congressional session.

| Cycle and event | Rows | Reported contests | Source-unobserved | Congressional session | Geography disposition |
| --- | ---: | ---: | ---: | --- | --- |
| 2022 regular primary | 13 | 13 | 0 | CD118 | CD118-to-CD119 continuity candidate |
| 2022 runoff | 13 | 2 | 11 | CD118 | CD118-to-CD119 continuity candidate |
| 2024 regular primary | 13 | 13 | 0 | CD119 | Exact CD119 session/key candidate |
| 2024 runoff | 13 | 0 | 13 | CD119 | Exact CD119 session/key candidate |
| 2026 regular primary | 13 | 13 | 0 | CD120 | Authority and crosswalk pending |
| 2026 runoff | 13 | 3 | 10 | CD120 | Authority and crosswalk pending |
| **Total** | **78** | **44** | **34** |  | **52 candidates / 26 pending** |

The 2022 continuity candidates use two pieces of retained evidence together: the Census declaration that Texas is absent from the five states whose plans changed for the 119th Congress, and the matching numbered state-district key inventories in the retained CD118 and CD119 TIGER layers. The package does not claim raw geometry equality.

The 2024 rows refer to the same CD119 session as the retained target geography and use exact Texas state-district GEOID keys. The 13 source-unobserved 2024 runoff rows may have an exact geography candidate without gaining a contest, candidate, vote, no-runoff, or no-contest disposition.

The 2026 rows map to the 120th Congress. They keep `historicalGeoid` null, `compatibilityCandidate` false, `confidence` null, and disposition `unassessed_cd120_authority_and_crosswalk_collection_pending`. CD119 is not substituted for CD120.

## Retained TIGER inventories

The package validates the exact ZIP hashes and extracted DBF-member hashes for both retained Texas layers:

| Layer | Source-lock ID | ZIP SHA-256 | DBF-member SHA-256 | Numbered districts | Special rows |
| --- | --- | --- | --- | ---: | ---: |
| CD118 | `tiger-cd118-48` | `eb07bd3e91c902b3289db239a3fee0bc1e248bfa672a0a1d347572ee79c1fa68` | `d72e8c1bebc681f31ceeac111678ea8dae432b346200a2e46004e0c2e4dc6c8d` | 38 | 0 |
| CD119 | `tiger-cd119-48` | `769b4ca318a4b06f9ced717d3a55b6dc94fd98205248c1496d3ce9f2927cda5c` | `de1fe345380fb369b7998fa1081f723b7b118327cecc0f65001d3e087d92c3ce` | 38 | 0 |

Each inventory contains Texas FIPS `48`, exactly the numbered district codes `01` through `38`, and GEOIDs `4801` through `4838` for its declared congressional session. Neither layer contains a `ZZ` undefined-district sentinel or a `00` at-large row. The Illinois special-row expectation is therefore not applied to Texas.

The candidate uses the thirteen current target district keys `07`, `09`, `16`, `18`, `20`, `28`, `29`, `30`, `32`, `33`, `34`, `35`, and `37`. A matching number and GEOID in CD118 and CD119 contributes to the retained continuity evidence; matching numbers alone do not establish compatibility with the unretained CD120 plan.

## Result and identity boundaries

The geography package inherits every identity-event observation and preserves its source-observation status. Geography evidence does not:

- turn a source-unobserved regular-primary or runoff row into a result disposition;
- create candidate, vote, winner, nominee, advancement, or event-selection facts;
- collapse a regular primary and runoff into one row;
- approve a current-incumbent identity relationship;
- use candidate movement between numbered districts as a geographic crosswalk; or
- convert an exact state-district key into raw-boundary, population, or voter equivalence.

The package performs no raw TIGER geometry-equality assessment, overlap-threshold calculation, or population-equivalence analysis. The 2022 result is a proposed plan-continuity relationship supported by the official no-change declaration and both exact inventories, not a claim that the ZIPs or geometry coordinates are byte-identical.

## Texas 2026 evidence boundary

The retained 2026 canvass identifies election events and numbered congressional districts, but it does not provide the geographic plan or a crosswalk to the CD119 target layer. The package records the unresolved state as `cd120AuthorityStatus: not_retained_collection_pending` and `texas2026PlanCrosswalkStatus: not_retained_collection_pending`.

PlanC2333 and CD120 authority are not retained parents of this candidate. Their names describe the open acquisition scope only; this package does not claim that live research, an unretained legal-status page, an unretained map, or an unretained court instrument establishes any 2026 compatibility relationship. Before any 2026 row can become a candidate, a future package must retain and bind exact authoritative PlanC2333/CD120 plan evidence and perform the separately specified compatibility or crosswalk review.

## Review and gate lifecycle

The candidate informs existing decision `approve-historical-district-cd119-compatibility-v1`. Its resolution remains null, and the package creates no independent decision. All six inherited gates remain open:

1. `retain_and_reconcile_exact_scope_final_certification_authority`
2. `review_incumbent_candidate_identity`
3. `review_historical_district_compatibility`
4. `decide_nonstandard_primary_disposition_treatment`
5. `review_progressive_candidate_classification`
6. `complete_human_data_review_and_publication_approval`

Every row remains compatibility-unapproved, identity-unapproved, evaluator-excluded, score-ineligible, reviewer-only, and publication-ineligible. The official-canvass receipt remains `official_canvass_report_retained_certification_not_separately_bound`. Generation performs no approval, scoring, publication, deployment, promotion, or public-route change.

## Exact parent closure

The source-lock entry has these six parents in order:

1. `house-democratic-primary-source-selection-proposal-20260804-v1`
2. `texas-house-democratic-primary-results-2022-2026-v1`
3. `texas-current-incumbent-primary-event-identity-candidate-v1`
4. `census-cd119-plan-change-authority-20260805`
5. `tiger-cd118-48`
6. `tiger-cd119-48`

The retained parent hashes include:

- proposal file `85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1`, package `a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb`;
- Texas receipt file `fa5db68682dd7f3183e834e881ddac016833065c5424dc1c95b92cddb489488e`, package `f010c5c0a4915d2c73feb46e7cf6617e109e1c7bfc6e1b94449e393410e809e1`, contest set `10ac515b35866e680ca1741a30136e364fbaffff0248c87648f85204c98eb9ba`;
- Texas identity-event file `f91d18b3163a610ee60d65519b3ece2e6b627c9a71ca32abd297abb26e256a95`, package `3c9b24b36e1544088a9b85a2ae20d9c972f8fdacd18f15311fe13a4fbc968f2f`, observation set `275727a0e383aebb71e15ee14791e331645d63ebe5d34d230a22d29fc6e51f86`;
- Census CD119 authority file `66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670`;
- CD118 ZIP `eb07bd3e91c902b3289db239a3fee0bc1e248bfa672a0a1d347572ee79c1fa68`; and
- CD119 ZIP `769b4ca318a4b06f9ced717d3a55b6dc94fd98205248c1496d3ce9f2927cda5c`.

The parent-projection hash binds each geography row to the identity observation and row hash, event and source-observation status, exact receipt contest facts where present, target CD119 key, historical session/key or null pending state, certification boundary, and compatibility disposition.

## Reproduction and validation

```bash
npm run generate:tx-primary-geography-v1
npm run test:run -- src/ingestion/elections/texas-primary-geography-compatibility-candidate.test.ts
npm run data:verify
npm run typecheck
```

The generator deterministically reconstructs the package from the six retained parents. Validation closes all 78 rows, both TIGER inventories, the 26/26/26 cycle partition, the 52/26 candidate-versus-pending partition, source-observation preservation, parent and output source-lock ancestry, row hashes, row-set hash, parent-projection hash, and package hash.
