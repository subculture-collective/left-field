# California split-crosswalk policy dossier v1

Date: 2026-08-06
Status: proposed decision dossier; unresolved, unapproved, score-ineligible, publication-ineligible

## Outcome

The California authority and block-comparison chain has reached its factual boundary. The official AB 604 and Census CD119 assignments cover the same 519,723 California tabulation blocks. Four districts (`34`, `36`, `37`, and `43`) have identical source and target block sets; the remaining 48 relationships are non-identical and already carry `crosswalk_review_required`.

This dossier makes the remaining methodology choice concrete without resolving it. It contains one row for each of the 48 split relationships, binds the exact crosswalk, geography-v2, and joint-v2 parent bytes, and partitions the evidence into:

| Scope | Rows |
|---|---:|
| Current-incumbent joint-review scope | 38 |
| Statewide geography-only scope | 10 |
| Total split relationships | 48 |

The four exact-membership relationships are deliberately excluded from this policy scope because they already have a separate factual candidate path.

## Proposed decision

Decision `california-split-crosswalk-methodology-v1` asks whether any non-identical AB 604-to-CD119 relationship should become eligible for row-level review under a separately specified crosswalk methodology.

Recommended and default reversible choice: retain the exact-block-membership-only rule. This leaves all 48 split rows excluded from evaluator and publication use. Confidence is high because the authoritative whole-block comparison is complete and no population, voter, turnout, partisan, geometric, or other compatibility threshold has been authorized.

The retained alternatives are:

1. Authorize a separately versioned crosswalk methodology. Before any row review, it must specify the evidence measure, weighting, threshold, confidence treatment, missing-data behavior, and impact analysis.
2. Mark split historical comparisons unavailable or incompatible. This closes the affected rows without deriving a relationship.

Selecting a methodology does not approve a row. Every affected row would still require an independent, evidence-bound row decision. A policy resolution alone cannot create geography approval, identity approval, evaluator eligibility, a score, publication, or deployment.

## Guard cases and limits

- District 12 demonstrates asymmetric set containment: all 8,894 AB 604 source blocks map to same-numbered CD119 district 12, but that target has 8,895 blocks. Near equality is not exact membership.
- District 41 demonstrates that a district number is not a mapping rule: none of its 6,975 source blocks map to CD119 district 41.
- The existing parts-per-million shares count 2020 Census tabulation blocks. They are not population, registered voters, turnout, partisan performance, or electoral weight.
- The dossier uses no overlap threshold, district-number continuity, raw geometry equality, population weighting, voter weighting, turnout weighting, or partisan weighting.

The decision remains `proposed` with null decision, reviewer, timestamp, and rationale. The artifact contains zero policy approvals, row approvals, score-eligible rows, published rows, or deployed rows. Unrelated work is not blocked.

## Artifact and reproduction

| Field | Value |
|---|---|
| Artifact | `data/metadata/california-split-crosswalk-policy-dossier-v1.json` |
| Bytes | 95,638 |
| SHA-256 | `2614f913e45e826d953f9ecc95595b2323b8e78c7db991c612c4807183b1422a` |
| Package SHA-256 | `3b0995a1378dc3fb5ab96612c31df8a39610ec07a667b38ba9bdc5ed5166da3a` |
| Row-set SHA-256 | `be90cf2fdcc573e7406f2892450a8165ffc20d0c3744c50a6af64cde3e9b1027` |

```bash
npm run generate:ca-split-crosswalk-policy-v1
npx vitest run src/ingestion/elections/california-split-crosswalk-policy-dossier.test.ts --maxWorkers=1
npm run data:verify
```

The next geography step depends on the unresolved methodology decision. It is not a missing-authority or missing-block-data task. Other independent source, identity, classification, scoring, interface, and production-readiness work remains actionable.
