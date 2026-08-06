# Texas 2026 congressional plan authority source receipt

## Outcome

This source receipt retains the official evidence needed to evaluate Texas's 2026 congressional-plan geography without substituting the 119th-Congress plan for the 120th-Congress plan.

Texas H.B. 4, 89th Legislature, Second Called Session, identifies PlanC2333 and says the act applies beginning with the 2026 primary and general elections for the 120th Congress. The Texas Legislative Council dataset identifies PlanC2333 as enacted in 2025 and publishes the exact `PLANC2333_blk.zip` block-equivalency resource.

The current legal/election-use statement is deliberately time-qualified. The retained Texas Redistricting page says a federal district court enjoined PlanC2333 on November 18, 2025, the Supreme Court granted a stay on December 4, and PlanC2333 is again in effect beginning with the 2026 primaries pending Supreme Court action on the appeal. This receipt does not infer permanence, decide the litigation, or claim legal status after the 2026-08-06 cutoff.

## Block evidence

The official PlanC2333 ZIP contains exactly one member, `PLANC2333.csv`, with fields `SCTBKEY` and `DISTRICT`. It contains 668,757 unique 15-digit Texas 2020 Census tabulation-block GEOIDs assigned to all 38 numbered districts. The Census CD119 national Block Equivalency File supplies the comparison layer; the deterministic `48_TX_CD119.txt` extract also contains the same 668,757 unique Texas blocks across 38 districts.

| Retained input | Bytes | SHA-256 |
|---|---:|---|
| Texas current-districts legal-status page | 27,609 | `626b36b109ad33163e01063f31bce526ff7e499ac8a85268d992725bf03ae6d8` |
| Enrolled H.B. 4 HTML | 1,262,192 | `ac6ade738a107c395f61edb78787e1e1cf677081e55d49552fe717b1dffedb1c` |
| Texas Legislative Council PlanC2333 dataset metadata | 170,392 | `7e0dbec7cd044701772fb6f20de033513337dc2a4331efd93a75d367def64683` |
| Official `PLANC2333_blk.zip` | 1,793,530 | `3672811ec032900e911337ac0ec455e786e6350576aa01117aeae2b8de28f80e` |
| Extracted `PLANC2333.csv` | 14,581,459 | `ff34cb7e7464f7ed55eff83bd2a86f3812e446167e488456c5e5c2376d8883b5` |
| Census CD119 Texas extract | 13,375,152 | `4eec50a54cf0dca2e6126a12f84a619bbeadbe68b5b23005030a82c78f5069df` |

The Census had not published a CD120 Block Equivalency File at this cutoff. PlanC2333 is therefore classified accurately as the Texas Legislative Council's state-maintained 2020-block assignment, not mislabeled as a Census CD120 product.

The PlanC2333 dataset metadata supplies no license ID or title. The repository records public governmental access and provenance, but does not treat that as an affirmative reuse license or publication permission. The retained files remain reviewer evidence; no identity, compatibility, approval, scoring, publication, or deployment state changes in this source-only slice.

## Reproduction

```bash
npm run fetch:tx-2026-congressional-plan-authority
npx vitest run scripts/fetch-texas-2026-congressional-plan-authority.test.ts
npm run data:verify
```

The next deterministic step is the 26-observation PlanC2333-to-CD119 block crosswalk. Exact membership is the only allowed compatibility-candidate rule; split relationships remain review-required without a threshold inference.
