# Maine primary identity/geography review package v1 — 2026-08-07

## Outcome

This reviewer-only package joins all six Maine current-incumbent identity observations to their six historical-geography observations and creates five independently reviewable proposed decisions.

- Five records are `identity_and_geography_candidates`: two exact reordered Chellie Pingree observations and three documented middle-name relationships for Pingree and Jared Golden.
- The 2026 ME-02 record is `geography_candidate_identity_source_unobserved`: Golden is absent from the four-candidate source contest, so the current-incumbent candidate name and linked votes remain null while the geography candidate remains separately reviewable.
- Geography remains a 2/2/2 partition: two CD118-to-CD119 assignment-identity candidates for 2022, two same-CD119-session candidates for 2024, and two bounded state-law-continuing-plan candidates for 2026 without Census CD120 geometry or an inferred historical GEOID.

The join approves no parent. Every identity, geography, joint, evaluator, scoring, classification, publication, and deployment gate remains false, excluded, or unresolved.

## Result and ranked-choice boundary

The package preserves the result receipt and identity candidate without manufacturing conclusions. Five records retain no source winner marker. The 2026 ME-02 record retains Matthew G. Dunlap as the explicit result-only RCV winner, but Dunlap is not Jared Golden identity evidence and is not linked to the current incumbent.

The municipal first-choice workbook and central-count RCV summary remain distinct projections. Their named round-one totals differ by 81 votes; source precedence remains unresolved. The package does not convert the source winner marker, vote rank, one-candidate contests, or current-incumbent nonappearance into an incumbent winner, loss, withdrawal, retirement, nomination, ordinary-primary margin, or evaluator value.

## Geography boundary

The 2022 records rely on complete normalized Census CD118/CD119 Maine assignment identity across 47,138 blocks, not raw coordinate or geometry equality. The 2026 records rely only on the enacted “2022 and thereafter” plan rule, current codification, and decennial review cadence. Both have `historicalGeoid: null`, `cd120CensusGeometryRetained: false`, and `noCd120CensusGeoidInferred: true`.

The retained enacted-plan text has not been directly crosswalked to the Census layer, so source-plan-to-layer equality remains unassessed. The joint package introduces no raw-geometry, overlap, population-equivalence, or exact Census CD120 claim.

## Proposed decisions

All five proposed decisions cover all six records, have null reviewer, reviewed-at, and resolution fields, and default to excluding affected records from evaluator and publication:

1. Accept the retained Maine Secretary primary tabulations with their exact cycle-specific certification boundaries and no new winner or nomination conclusion.
2. Accept all six bounded geography candidates while preserving the 2026 no-CD120-geometry boundary.
3. Accept five exact or documented identity candidates while retaining the 2026 ME-02 incumbent source nonappearance.
4. Preserve ranked-choice and nonstandard-primary disposition exclusion pending separate review.
5. Preserve progressive-classification exclusion until separate evidence and review exist.

Each decision remains independent; accepting one does not resolve another or authorize publication.

## Provenance and pins

The exact ordered direct parents are the House primary source-selection proposal, Maine identity candidate, and Maine geography candidate. The result workbooks and RCV summary, roster, House Clerk XML, Congress Legislators snapshot, enacted plan and statutes, Census bundles/extracts, plan-change page, and TIGER archive remain transitively bound through those parents.

- artifact bytes: `31735`
- file SHA-256: `eda87181e5eedae58e1ca3a79a1f5703e9030ca86086b29605adc2e925815275`
- source-set SHA-256: `29ff7c3d6c41e1276c7d408a35d8eeeed04893361b48d840fa4e5ab7d6ea0dbe`
- package SHA-256: `ee5cc894c95fb17a662c1197125078909d5e042ed42d3915f351801d8f01a283`
- review-record-set SHA-256: `8fe903813e1e924e1c173577e9ce29f1b542cf3d1c11b8cab9eed8c855122e38`
- decision-set SHA-256: `5048910d5632be13576707553d42e4bc5e30caba59d9927a930e206deb4dcf14`

## Reproduction

```bash
npm run generate:me-primary-joint-review-v1
npx vitest run \
  src/ingestion/elections/maine-house-democratic-primary-results-receipt.test.ts \
  src/ingestion/elections/maine-current-incumbent-primary-linkage-candidate.test.ts \
  src/ingestion/elections/maine-primary-geography-authority-source-receipt.test.ts \
  src/ingestion/elections/maine-primary-geography-compatibility-candidate.test.ts \
  src/ingestion/elections/maine-primary-identity-geography-review-package.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The generator is create-only and byte-deterministic. The validator reconstructs the expected package from the exact immutable parents and canonically compares the complete supplied value. Parent byte or topology drift; identity/geography join substitutions; Golden/RCV/CD120 escalation; fabricated approvals, reviewers, decisions, scores, classification, or publication; and unknown fields are rejected.
