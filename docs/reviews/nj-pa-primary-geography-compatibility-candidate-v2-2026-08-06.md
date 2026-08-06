# NJ/PA primary geography compatibility candidate v2

Date: 2026-08-06  
Status: proposed reviewer evidence; unapproved, score-ineligible, publication-ineligible

## Outcome

This package composes the immutable 41-row NJ/PA geography v1 with the New Jersey 2026 state-plan authority receipt. It preserves all 32 inherited 2022/2024 candidates and changes only the nine New Jersey 2026 rows that v1 deliberately left authority-pending.

The nine rows—districts `01`, `03`, `05`, `06`, `08`, `09`, `10`, `11`, and `12`—become `explicit_2022_2031_state_election_plan_continuity_candidate`. The supporting facts are New Jersey's current publication of its `2022-2031` congressional plan, the adopted-map label, NJSA 19:46-12's continuing-use rule, and the complete 137,972-block Census CD119 New Jersey assignment.

All 41 rows are now geography candidates. None is approved, identity-approved, score-eligible, evaluator-authorized, published, or deployed.

## Evidence boundary

The nine 2026 rows retain `historicalCongressSession: "120"` and `historicalGeoid: null`. The package does not claim that Census has published a CD120 product. Its continuity evidence instead points to the state authority receipt and explicitly continuing state plan.

The official plan-components report remains excluded from adopted-membership evidence because its 11,858 explicit blocks include 164 district-8/district-10 assignments that disagree with CD119. Version 2 does not erase, reconcile, or infer a reason for that conflict.

No raw geometry equality, spatial overlay, overlap threshold, district-number-only assumption, population weighting, voter weighting, electoral weighting, or court-search claim is used. The authority receipt states that a separate court-invalidation assessment was not researched or retained; the candidate is conditional on the current state publication and statute.

## Lineage and lifecycle

The artifact has exactly two direct source-lock parents:

- `nj-pa-primary-geography-compatibility-candidate-v1`
- `new-jersey-2026-congressional-plan-authority-receipt-v1`

Each v2 row preserves its exact v1 row digest. Geography v1 remains immutable and is not superseded as historical reviewer evidence. The existing geography decision remains unresolved with no reviewer identity, timestamp, or resolution. Accepting these relationships would resolve geography only; identity, certification, classification, evaluator, factual promotion, and publication gates remain independent.

## Reproduction

```bash
npm run generate:nj-pa-primary-geography-v2
npx vitest run src/ingestion/elections/nj-pa-primary-geography-compatibility-candidate-v2.test.ts --maxWorkers=1
npm run data:verify
```

The canonical artifact is `data/metadata/nj-pa-primary-geography-compatibility-candidate-v2.json`: 61,612 bytes, SHA-256 `50ca543dcf9ff39cbb712ad19246d7bc3154da2c593b3cf4ff106468ed84f083`, package SHA-256 `cabffbdea11fddf17d4f63fc57f4d9c89cb9eaa202fceb2b5da6c92d841ecb5b`, and row-set SHA-256 `c69cfe00727b4c69c60f4331069346467d015eb69f45b495480790b064facc45`.
