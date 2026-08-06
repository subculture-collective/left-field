# Washington primary geography compatibility candidate v1

## Outcome

This reviewer-only package binds all 16 Washington current-target identity observations to official congressional-district inventories. Eight 2022 rows are CD118-to-CD119 plan-continuity candidates; eight 2024 rows are exact CD119 same-session/key candidates. All 16 retain high-confidence geography evidence while remaining unapproved and score-ineligible.

The 2022 conclusion is deliberately limited. The retained Census authority identifies Alabama, Georgia, Louisiana, New York, and North Carolina as the states that redrew congressional plans for CD119; Washington is absent. The official CD118 and CD119 Washington TIGER DBFs independently contain the complete ten-district inventories with matching `53xx` keys. Together these facts support a plan-continuity candidate, not raw-coordinate equality, overlap, population equivalence, or automatic approval.

## Identity, result, and formula boundaries

Every row binds the exact parent identity observation and row hash, certified contest ID and hash, cycle, seat, and district. Fifteen parent identity links remain proposed, including the two bounded DelBene middle-initial relationships. The 2022 WA-06 geography candidate preserves its parent `reported_contest_no_unique_candidate_match`; Derek Kilmer is not linked to Emily Randall.

Every row preserves `certificationStatus: certified`, `nominationSystem: top_two`, `sourceWinnerStatus: not_established`, and `formulaApplicability: confirmed_incompatible`. Party preference is not nomination or endorsement. Geography establishes no source winner or advancement and supplies no evaluator value. Compatibility approval, identity approval, selection, score eligibility, publication, and deployment all remain false or unresolved. The safe default excludes every row from the partisan-primary evaluator.

## Reproduction and integrity

```bash
npm run generate:wa-primary-geography-v1
npx vitest run src/ingestion/elections/washington-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```

The artifact is 29,143 bytes with file SHA-256 `393ce5c9394102686777e1a87ba6e63665ab617f6fd3d7c83dcea1392078389b`. Its package SHA-256 is `22e6eaf9d819c1939b3260cb7173cff576371344f2da75dd520d7b6c2d06d251`, and its row-set SHA-256 is `bf7bf88c3cd5030f56a326391e60c3ebea08dfc97c9430277a22e27bfc983d22`.

The source-lock entry has exactly six direct parents: the source-selection proposal, certified Washington receipt, Washington identity candidate, Census plan-change authority, and official CD118/CD119 Washington TIGER archives. Validation rejects source or lineage drift, incomplete district inventories, identity/receipt join drift, row/set/package hash drift, fabricated approval, and fully rehashed attempts to relabel CD118 continuity as exact CD119 evidence.
