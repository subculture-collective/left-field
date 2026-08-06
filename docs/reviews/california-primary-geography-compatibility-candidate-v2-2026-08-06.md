# California primary geography compatibility candidate v2

Date: 2026-08-06  
Status: proposed reviewer evidence; unapproved, score-ineligible, publication-ineligible

## Outcome

This package composes the immutable California geography candidate v1 with the source-locked 2026 Proposition 50 / AB 604-to-CD119 block crosswalk. It retains all 156 certified top-two contest-cycle observations and changes only the evidence available for the 52 rows whose historical session is CD120.

The composition produces 108 geography candidates:

- 52 inherited CD118-to-CD119 plan-continuity candidates for 2022;
- 52 inherited exact CD119 session-and-district-key candidates for 2024;
- four new exact 2020 Census block-membership candidates for 2026, districts `34`, `36`, `37`, and `43`.

The other 48 CD120 rows remain `crosswalk_review_required`. District 12 is an important guard case: all 8,894 AB 604 source blocks map to same-numbered CD119 district 12, but that target contains 8,895 blocks, so the sets are not equal and the row is not promoted.

## Evidence and method

The package has exactly two direct source-lock parents:

- `california-primary-geography-compatibility-candidate-v1`
- `california-2026-primary-block-crosswalk-candidate-v1`

The crosswalk parent already transitively locks the current election-use statement, official Proposition 50 voter guide, official AB 604 plan source, and both normalized block layers. The two layers contain the same 519,723 unique 2020 Census tabulation blocks across districts `01`–`52`; 133,426 assignments differ between plans. Those are block-assignment provenance facts, not population, electorate, turnout, partisan, or vote measurements.

Whole-set equality is the only promotion rule. The generator does not use an overlap threshold, same district number alone, raw geometry equality, population equivalence, voter weight, electoral weight, or an assumption of permanent legal status. All 2026 rows retain a null `historicalGeoid`: no Census CD120 GEOID authority is claimed, and exact evidence instead remains explicit in each row's `planBlockCrosswalk` object.

## Lifecycle boundary

Geography v1 remains immutable, retained, and not superseded. Version 2 is a deterministic composition candidate; it does not rewrite either parent.

All 156 rows remain California top-two formula-incompatible and excluded from the party-primary evaluator. The package records zero compatibility approvals, zero identity approvals, zero numeric evaluator values, zero score-eligible rows, and no reviewer identity, resolution, publication, or deployment. The four exact CD120 rows are candidates only. Accepting the proposed geography relationship would still require the independent identity, California top-two methodology, factual promotion, and publication gates before any score or public release.

## Reproduction

```bash
npm run generate:ca-primary-geography-v2
npx vitest run src/ingestion/elections/california-primary-geography-compatibility-candidate-v2.test.ts --maxWorkers=1
npm run data:verify
```

The canonical artifact is `data/metadata/california-primary-geography-compatibility-candidate-v2.json`: 278,231 bytes, SHA-256 `1c47fdba328c2930a99ce8d0dde9a33bb974433295b70d7109c462c47be76eba`, package SHA-256 `daf19746a654ac9343daf434e3462bbfde31f1e3a09ec9b8f8ebc1136fd41c16`, and row-set SHA-256 `215d3eb8156113e3830f458407651640af6e5d6fb2059654ddfabd162a9bee86`.
