# House Democratic primary source-selection proposal — 2026-08-04

## Status

This is a reviewer-only, nonpublishable acquisition contract. It contains no certified primary result, selected contest, historical candidate linkage, progressive classification, vote total, margin, share, evaluator value, or public route.

The exact target is the 212 occupied regular Democratic voting U.S. House seats in published release `rel_full_20260804_v2`. The proposal enumerates 38 states and exactly 114 state-cycle rows for 2022, 2024, and 2026. Every state-cycle says `resultAuthorityStatus: not_retained`; every seat remains score-ineligible with explicit missing values.

## Retained inputs and limits

- The factual projection fixes the 212-seat target universe.
- The incumbent roster binds each target seat to one unique BioGuide identity. It establishes the current incumbent, not that person's participation in a historical primary.
- The FEC 2026 congressional calendar is discovery and drift-detection evidence only. It is not state result or certification authority.
- Current CD119 geometry is a target reference only. It is not evidence that a historical district with the same number had identical boundaries, and it is not an approved allocation method.

The repository now retains certified Washington 2022 and 2024 top-two House results, but they are not partisan Democratic-primary evidence and remain formula-incompatible. It also retains a new, versioned Illinois 2022/2024 official-result candidate containing all 34 district exports. Illinois remains nonpublishable and score-ineligible because the exact final-certification receipt, current-incumbent candidate bindings, historical-geography approvals, and progressive classifications have not been retained or reviewed. No nationwide, formula-compatible cohort, complete official historical candidate roster, or approved historical-district crosswalk exists. FEC finance and proposed AIPAC/UDP challenger relationships are not election-result substitutes and cannot satisfy those requirements.

## Proposed future selection rule

The proposed rule selects the latest completed, certified, regular Democratic House nomination contest at or before the cutoff in which the current target incumbent actually participated. It never substitutes a prior officeholder when the current incumbent was not a candidate, and it never turns an unknown, uncontested, not-yet-held, or inapplicable contest into zero.

Before any later numeric candidate can be score-eligible, it needs retained original state authority, final certification, complete option and valid-vote reconciliation, authoritative or reviewed candidate identity, compatible historical geography, an approved contest-system/disposition rule, and—only for progressive share—a separate reviewed candidate-classification record effective for that contest. Top-two, open, special, runoff, uncontested, and no-primary cases remain unresolved rather than being forced through the partisan-primary formula.

## Exact proposal

- Artifact: `data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json`
- File size: 411,793 bytes
- File SHA-256: `85246e9adfd181e6f24606b6eaa29250c45c9e8e42a6dd5af5cb162de17f45b1`
- Package SHA-256: `a090e0be03dc2b0fa5edd0c1132a8261eed0f98ceb4df090154d0b150d8721fb`
- State-cycle rows: 114
- Seat rows: 212
- Evaluator numeric values: 0
- Unresolved reviewer decisions: 6

Every decision defaults to `retain_plan_exclude_from_evaluator_and_publication`, blocks publication, and does not block continued official-source acquisition.

## Reproduction

```bash
npm run generate:house-democratic-primary-source-selection-proposal
npm run test:run -- src/ingestion/elections/house-democratic-primary-source-selection-proposal.test.ts
npm run data:verify
```
