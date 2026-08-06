# Texas current-incumbent primary event identity candidate v1

Date: 2026-08-05

Status: proposed reviewer-only identity and disposition evidence; not approved, selected, score-bearing, published, or deployed

## Outcome

The candidate closes the exact current-target event universe for the thirteen Texas Democratic U.S. House seats in the retained roster. It emits one observation for every target district across the 2022, 2024, and 2026 regular-primary and runoff events:

- 13 target seats × 3 cycles × 2 event stages = 78 observations;
- 39 regular-primary observations and 39 runoff observations;
- 44 observations backed by a reported contest in the retained Texas official canvass receipt;
- 115 candidate rows and 2,041,818 candidate votes across those 44 reported contests;
- 34 district-event observations not reported in the retained canvass, preserved as disposition-unresolved;
- 33 proposed current-incumbent identity links: 25 exact normalized-name observations and eight high-confidence derived name relationships;
- 11 reported contests with no unique same-district current-incumbent match; and
- 30 proposed regular-primary links and three proposed runoff links.

Artifact: `data/metadata/texas-current-incumbent-primary-event-identity-candidate-v1.json`

Artifact byte size: `168229`

Artifact SHA-256: `f91d18b3163a610ee60d65519b3ece2e6b627c9a71ca32abd297abb26e256a95`

Package SHA-256: `3c9b24b36e1544088a9b85a2ae20d9c972f8fdacd18f15311fe13a4fbc968f2f`

Observation-set SHA-256: `275727a0e383aebb71e15ee14791e331645d63ebe5d34d230a22d29fc6e51f86`

Parent-projection SHA-256: `aa907b1c0a796c4605f9136c32b0837933ec4300f612aae44f110b588a827548`

## Exact event partition

| Cycle and event | Target observations | Reported contests | Proposed identity links | Reported, no unique current match | Source-unobserved and disposition-unresolved |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2022 regular primary | 13 | 13 | 11 | 2: districts 18 and 32 | 0 |
| 2022 runoff | 13 | 2: districts 28 and 30 | 2: districts 28 and 30 | 0 | 11 |
| 2024 regular primary | 13 | 13 | 12 | 1: district 18 | 0 |
| 2024 runoff | 13 | 0 | 0 | 0 | 13 |
| 2026 regular primary | 13 | 13 | 7: districts 07, 16, 18, 20, 28, 29, and 34 | 6: districts 09, 30, 32, 33, 35, and 37 | 0 |
| 2026 runoff | 13 | 3: districts 18, 33, and 35 | 1: district 18 | 2: districts 33 and 35 | 10 |
| **Total** | **78** | **44** | **33** | **11** | **34** |

The 34 source-unobserved rows do not assert that no runoff, primary, contest, or candidate existed. Their exact relationship disposition is `not_linked_no_reported_contest_disposition_unresolved`. The 11 reported contests without a unique current-incumbent match remain `not_linked_no_unique_current_incumbent_candidate_same_district`; their candidate rows are retained as source evidence but are not reassigned to the current roster identity.

## Identity evidence boundary

Matching is limited to the same current target district and the same retained election event. Cross-district matching is forbidden. The 33 proposed links contain:

- 25 `exact_normalized_official_house_name_same_district` observations;
- five `derived_middle_initial_omission_same_district` relationships: Sylvia R. Garcia in the 2022, 2024, and 2026 regular primaries, and Marc A. Veasey in the 2022 and 2024 regular primaries;
- one `derived_retained_public_alias_same_district` relationship for Lizzie Fletcher / `LIZZIE PANNILL FLETCHER` in the 2026 regular primary; and
- two `derived_retained_full_middle_name_same_district` relationships for Christian D. Menefee / `CHRISTIAN DASHAUN MENEFEE` in the 2026 regular primary and runoff.

These are name relationships proposed for documented review, not direct candidate-to-BioGuide identifier bridges. `directIdentifierBridgeAvailable` is false for all 78 rows and `identityApproved` is false for every proposed link.

The same-district requirement prevents predecessor and cross-district substitution. In particular:

- Sheila Jackson Lee's 2022 and 2024 district 18 observations are not assigned to current incumbent Christian D. Menefee;
- Colin Allred's 2022 district 32 observation is not assigned to current incumbent Julie Johnson;
- Julie Johnson's appearance in the 2026 district 33 regular primary and runoff is not assigned to current district 33 incumbent Marc A. Veasey or moved to her current district 32 seat;
- Greg Casar's appearance in the 2026 district 37 regular primary is not assigned to current district 37 incumbent Lloyd Doggett or moved to Casar's current district 35 seat; and
- candidate-bearing 2026 observations in current districts 09, 30, 32, 35, and the other no-match rows remain unresolved rather than being forced onto the current roster.

## Winner, runoff, and certification boundary

The Texas canvass receipt marks no source winner. Every reported observation retains `sourceWinnerStatus: not_marked_by_source`, and the identity candidate keeps every selection status `unselected_no_source_winner_or_disposition_resolution`.

The generator does not infer a winner, nominee, advancement, selected event, or evaluator value from:

- the largest vote total or canvass percentage;
- the printed incumbent marker;
- the existence or candidate composition of a runoff;
- a current-incumbent name match; or
- the absence of a district from a regular-primary or runoff report.

Regular-primary and runoff observations remain separate. A runoff does not replace its regular primary, and neither event is selected for evaluator use. Although the retained PDFs are Texas Secretary of State Official Canvass Reports, the candidate inherits `official_canvass_report_retained_certification_not_separately_bound`; it does not claim a separately retained signed, sealed, or statutory final-certification instrument for the exact scope.

## Review and gate lifecycle

The package supplies evidence to two existing unresolved decisions and creates no independent decision:

- `approve-historic-primary-candidate-identity-resolution-v1`; and
- `decide-nonstandard-primary-disposition-treatment-v1`.

Both resolutions remain null. The artifact inherits all six unresolved parent gates:

1. `retain_and_reconcile_exact_scope_final_certification_authority`
2. `review_incumbent_candidate_identity`
3. `review_historical_district_compatibility`
4. `decide_nonstandard_primary_disposition_treatment`
5. `review_progressive_candidate_classification`
6. `complete_human_data_review_and_publication_approval`

Every observation remains reviewer-only, publication-ineligible, identity-unapproved, geography-unapproved, disposition-unresolved where applicable, unselected, evaluator-excluded, and score-ineligible. Generation performs no review approval, promotion, publication, deployment, or public-route change.

## Parent closure

The candidate is bound to these exact retained parents:

- target roster file SHA-256 `8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1`, roster SHA-256 `cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee`;
- source-selection proposal file SHA-256 `85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1`, package SHA-256 `a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb`;
- House Clerk member XML SHA-256 `4ccea8259aff2df6a175545e45bdac2dfcdf0085a9cc7ab6c46aa80527bc524b`;
- Congress Legislators current snapshot SHA-256 `bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf`; and
- Texas results receipt file SHA-256 `fa5db68682dd7f3183e834e881ddac016833065c5424dc1c95b92cddb489488e`, package SHA-256 `f010c5c0a4915d2c73feb46e7cf6617e109e1c7bfc6e1b94449e393410e809e1`, contest-set SHA-256 `10ac515b35866e680ca1741a30136e364fbaffff0248c87648f85204c98eb9ba`.

The parent-projection hash binds each emitted row back to its roster identity, event coverage or reported contest, exact contest hash, reported-contest candidate count and total candidate votes, retained source candidate where present, match method, certification boundary, source-winner status, and unresolved disposition state.

## Reproduction and validation

```bash
npm run generate:tx-primary-event-identity-v1
npm run test:run -- src/ingestion/elections/texas-current-incumbent-primary-event-identity-candidate.test.ts
npm run data:verify
npm run typecheck
```

The generation command deterministically reconstructs the artifact from the retained parents. Reproduction validates the 78-row event closure, the exact 44/34 reported-versus-unobserved partition, the 115 candidate rows and 2,041,818 candidate votes, the 33/11 linked-versus-no-match reported partition, the 25/8 exact-versus-derived evidence split, regular/runoff separation, source-lock ancestry, parent hashes, row hashes, observation-set hash, parent-projection hash, and package hash.
