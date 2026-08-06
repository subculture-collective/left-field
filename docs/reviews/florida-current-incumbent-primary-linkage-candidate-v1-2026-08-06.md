# Florida current-incumbent primary linkage candidate v1

## Scope

This reviewer-only candidate closes exactly 14 observations: current Florida Democratic target districts 09, 10, 14, 22, 23, 24, and 25 in each of the 2022 and 2024 Democratic U.S. House primary cycles. It binds the exact seven-seat target roster, House Clerk MemberData, Congress Legislators Current, the unresolved nationwide source-selection proposal, Florida's official-results receipt, and the source-lock ledger.

The Florida Division statewide extracts contain reported contests for seven of those district-cycle observations. The other seven are absent from the retained official extracts and remain `source_unobserved_district_cycle_unresolved`; their contest identifiers, contest hashes, candidate counts, vote totals, candidate relationships, result authority, and certification fields are all null. Source absence is not interpreted as zero votes, no candidate, or no primary.

## Proposed relationships

| Evidence | Rows | Boundary |
| --- | ---: | --- |
| Exact normalized official-House/source name in the same district | 4 | Same-district name observation only; the source supplies no person identifier. |
| Source middle name absent from official House name | 2 | `Maxwell Alejandro Frost` to `Maxwell Frost`, in FL-10 for 2022 and 2024. |
| Official House middle initial absent from source name | 1 | `Frederica Wilson` to `Frederica S. Wilson`, in FL-24 for 2022. |
| Official extract has no reported target district-cycle block | 7 | No relationship and no numeric value proposed. |

The seven reported observations cover 27 named candidate rows and 393,063 votes. All seven links are proposed, high-confidence name relationships pending documented review. The two derived name rules are limited to the three named rows above and do not provide a general fuzzy-match path.

## Authority and lifecycle boundary

Every reported observation preserves `division_official_results_extract_retained` and `official_results_flag_retained_no_separate_signed_certificate`. Florida's extracts do not mark a winner, so this package does not infer a winner from vote rank, select a nominee, approve identity or geography, create evaluator values, or promote any row. The seven unobserved blocks likewise remain unresolved. The future 2026 primary contributes no observation.

The package is `proposed`, reviewer-only, publication-ineligible, and score-ineligible. Reviewer identity, review timestamp, resolution, and every inherited source-selection decision remain null. The recommended reversible decision is to accept four exact and three narrowly derived same-district name links while retaining all seven source-unobserved observations as unresolved. The safe default excludes all 14 observations until identity, historical-geography, disposition, and publication review are complete.

## Integrity

- Artifact SHA-256: `c71e77ba87f073c967edffdc564ac5cdaee19a285c55c4b72afb08a537d21b83`
- Package SHA-256: `d92bbd35721c2fc40877c7a625bb4c1a85d23cd73fe6e3b0384dcb8dfae1fce3`
- Observation-set SHA-256: `220bdca66add6e79a35933ddc6ac918d169e24a47b8500daccb52c93f89c97fc`
- Parent-projection SHA-256: `8e9e2c530a196f613c57fc50417fc9fa0a71d1d8420ab0a7ef4440a525288f36`
- Deterministic rebuild: `npm run generate:fl-current-incumbent-primary-linkage-v1`

The exact five direct parents are the incumbent roster, unresolved source-selection proposal, House Clerk source, Congress Legislators source, and Florida results receipt. Validation rejects parent/source-lock drift, hash drift, observation-set drift, cardinality drift, lifecycle escalation, or a rehashed attempt to approve a row.
