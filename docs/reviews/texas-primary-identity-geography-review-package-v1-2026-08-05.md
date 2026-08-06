# Texas primary identity-geography joint reviewer package v1

Date: 2026-08-05

Status: proposed reviewer queue; no decision resolved, no parent approved, no evaluator value, score, publication, or deployment

## Outcome

The package joins the exact 78 Texas current-target identity-event observations one-to-one with their geography rows. It preserves the regular-primary/runoff event grain, source-observation status, certification boundary, and independent identity, geography, disposition, classification, and publication gates.

The resulting review matrix is:

| Review category | Records | Meaning |
| --- | ---: | --- |
| Identity and geography candidates | 25 | Both parent relationships are candidates, independently reviewable and unapproved |
| Geography candidate, identity unresolved | 27 | Geography evidence exists; identity remains no-match or source-unobserved |
| Identity candidate, CD120 geography pending | 8 | Identity evidence exists; 2026 geography remains authority pending |
| Identity unresolved, CD120 geography pending | 18 | Neither relationship is currently a candidate |
| **Total** | **78** | **33 identity candidates; 52 geography candidates** |

The records retain 44 reported-contest states and 34 source-unobserved district-events. A geography candidate does not invent a contest or result disposition, and an identity candidate does not select a winner, nominee, regular primary, or runoff.

Artifact: `data/metadata/texas-primary-identity-geography-review-package-v1.json`

Artifact byte size: `233427`

Artifact SHA-256: `f6b6636a3829685faa5b5b5fc47440726608d46e1d8b766c620e3d24d42d615f`

Package SHA-256: `d964089acf669dc2b95c3dfab19cd93f719619fecc3ac9dce411b3a90749be8b`

Review-record-set SHA-256: `3c02caebccbb9f88abb906c5901137e393180c986d7170d4464b31d4dbff5a9a`

Decision-set SHA-256: `2dbae651f20a1c9e3cdb5cdfa635fbf7c06f254b926c40b007df6667114be602`

Parent-projection SHA-256: `9365dcdf715e99f11909d1d5ea610a9df5fbab0ca2cc468a096d3c908cd4eb7c`

## Proposed decisions

All five decisions are proposed, have high evidence confidence, use `exclude_affected_records_from_evaluator_and_publication` as the reversible default, block only affected publication, and do not block continued work. Reviewer identity, review timestamp, and resolution remain null.

### Accept identity links

- Decision: `tx-primary:accept-identity-links-v1`
- Parent decision: `approve-historic-primary-candidate-identity-resolution-v1`
- Evidence: the 33 identity-candidate records only
- Recommendation: accept the 25 exact and eight bounded derived links while preserving the absence of direct person identifiers and leaving all 45 unresolved rows unlinked
- Alternatives: reject all links; or request targeted evidence for the eight derived-name relationships
- Boundary: acceptance would resolve identity only and would not approve geography, certification, disposition, classification, scoring, or publication

### Accept bounded geography compatibility

- Decision: `tx-primary:accept-geography-compatibility-v1`
- Parent decision: `approve-historical-district-cd119-compatibility-v1`
- Evidence: all 78 records, including the pending 2026 rows
- Recommendation: accept the 26 CD118-continuity and 26 exact-CD119 candidates without claiming raw geometry equality, while retaining all 26 CD120 rows as authority pending
- Alternatives: require block-level crosswalks for CD118 continuity; or reject all candidates
- Boundary: acceptance would resolve only the 52 2022/2024 candidates. It cannot substitute CD119 for CD120 or approve any 2026 row.

### Retain certification exclusion

- Decision: `tx-primary:retain-certification-exclusion-v1`
- Parent decision: `collect-official-state-primary-results-and-certification-v1`
- Evidence: all 78 records
- Recommendation: retain exclusion until an exact-scope final certification authority is acquired and bound
- Alternatives: treat the official canvass reports as sufficient final authority; or require contest-specific signed certification
- Boundary: every record remains `official_canvass_report_retained_certification_not_separately_bound`

### Retain primary-disposition exclusion

- Decision: `tx-primary:retain-primary-disposition-exclusion-v1`
- Parent decision: `decide-nonstandard-primary-disposition-treatment-v1`
- Evidence: all 78 records
- Recommendation: preserve separate regular and runoff events and unresolved states; infer no winner, nominee, advancement, no-contest state, or numeric zero
- Alternatives: select from vote rank/runoff presence; or convert source-unobserved events to no-contest or zero
- Boundary: the queue preserves 44 reported and 34 source-unobserved states without changing result disposition

### Retain progressive-classification exclusion

- Decision: `tx-primary:retain-progressive-classification-exclusion-v1`
- Parent decision: `approve-progressive-candidate-classification-method-v1`
- Evidence: all 78 records
- Recommendation: retain exclusion because neither identity nor geography evidence is contest-effective progressive-classification evidence
- Alternatives: treat incumbent identity as progressive classification; or zero-fill unknown classifications
- Boundary: every record keeps `progressiveClassificationStatus: not_retained`

## Parent and record integrity

The output source-lock entry has exactly three direct parents:

1. `house-democratic-primary-source-selection-proposal-20260804-v1`
2. `texas-current-incumbent-primary-event-identity-candidate-v1`
3. `texas-primary-geography-compatibility-candidate-v1`

The package binds the proposal file and package hashes; the identity file, package, observation-set, and parent-projection hashes; and the geography file, package, row-set, and parent-projection hashes. Each review record binds both parent row hashes plus event identity, reported or source-unobserved status, exact contest facts when present, candidate/pending states, certification, disposition, and classification boundaries.

The join does not approve either parent. Every identity approval, geography approval, joint approval, score eligibility, and evaluator inclusion remains false. All six inherited gates remain open, and all five inherited decision resolutions remain null.

## 2026 and result boundaries

All 26 rows for 2026 retain session `120`, null historical GEOIDs, geography status `authority_pending`, and `compatibilityCandidate: false`. The queue cannot turn matching district numbers, candidate movement, PlanC2333 research, or CD119 geography into a CD120 relationship. Exact PlanC2333/CD120 authority and crosswalk evidence remain a separate acquisition task.

The 34 source-unobserved event records remain disposition-unresolved. They do not mean no primary, no runoff, no contest, no candidate, or zero votes. Regular-primary and runoff records remain separate even when they share a district, cycle, and geography relationship.

## Reproduction and validation

```bash
npm run generate:tx-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/texas-primary-identity-geography-review-package.test.ts
npm run data:verify
npm run typecheck
```

The generator deterministically reconstructs the exact 78-record queue and five-decision set. Validation covers the four review categories, evidence-record scoping, exact parent and output ancestry, parent joins, record hashes, record-set hash, decision-set hash, parent-projection hash, package hash, CD120 non-substitution, result-disposition preservation, and rejection of fully rehashed approval or scoring escalation.
