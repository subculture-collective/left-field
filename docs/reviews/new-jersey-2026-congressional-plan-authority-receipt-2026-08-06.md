# New Jersey 2026 congressional plan authority receipt

Date: 2026-08-06  
Status: retained source evidence; no geography candidate, approval, score, publication, or deployment

## Outcome

New Jersey's current Division of Elections publications page identifies the operative map as `NJ Congressional Districts 2022-2031`. The linked official map states that it was adopted by the New Jersey Redistricting Commission on December 22, 2021. NJSA 19:46-12 says commission-established districts are used thereafter and remain unaltered through the next census-ending-zero year unless ruled invalid by a state or federal court.

Together, those retained sources support the time-bounded conclusion that the same state plan remains operative for the 2026 election absent an invalidating judgment. This receipt does not claim that Census has published a CD120 product, prove that no future court action is possible, or create a geography relationship.

The retained Census CD119 bundle supplies a deterministic New Jersey extract with 137,972 unique 15-digit 2020 Census block GEOIDs and exactly districts `01`–`12`. It is used as the complete block membership for the explicitly continuing state plan, not as a raw-geometry shortcut or a mislabeled CD120 source.

## Ancillary components-report conflict

The official `Plan Components Report` is retained because it is relevant public plan material, but it is not used as adopted-plan membership evidence. Its plan name is `NJ_CONG_SUMBIT12222021` and it enumerates 11,858 unique blocks across districts `01`–`12`. Compared with the Census CD119 assignment:

- 11,694 explicit assignments agree;
- 164 disagree;
- 86 blocks listed under report district 8 are CD119 district 10;
- 78 blocks listed under report district 10 are CD119 district 8.

The receipt does not infer the reason for that discrepancy. It records the mismatch and fails closed by excluding the ancillary report from the continuity membership claim. A later investigation may determine whether it represents an earlier proposal, a report-generation issue, or another plan-state distinction; none is asserted here.

## Method and boundaries

The authority conclusion depends on the current 2022–2031 publication, adopted-map label, and governing continuity statute. It does not depend on same-numbered districts alone, TIGER coordinate equality, spatial overlay, overlap thresholds, population, voters, turnout, or partisan measurements. No explicit reuse license was identified next to these public official sources, so the receipt records provenance without asserting a license grant.

The source-only artifact creates zero geography candidates, approvals, score-eligible rows, numeric evaluator values, publication eligibility, or deployment. The nine New Jersey 2026 rows in the immutable NJ/PA geography v1 remain pending until a distinct geography-v2 candidate composes this evidence.

## Reproduction

```bash
npm run fetch:nj-2026-congressional-plan-authority -- --cache-dir data/source/elections/primary-results/geography/new-jersey/2026
npm run generate:nj-2026-congressional-plan-authority
npx vitest run src/ingestion/elections/new-jersey-2026-congressional-plan-authority.test.ts --maxWorkers=1
npm run data:verify
```

Live fetch mode is intentionally strict and fails on byte drift. The retained-cache command above is the deterministic replay for the source-locked snapshot.

The canonical receipt is `data/metadata/new-jersey-2026-congressional-plan-authority-receipt-v1.json`: 4,294 bytes, SHA-256 `8d9256e823b9ad0157dcfc7c1f47f3b45c557f50069a82fe063ae4b0704541da`, and package SHA-256 `8bc2c27ba242db9161dc50deae74cf57436a75684f9dbe63ef9da03b09712327`.
