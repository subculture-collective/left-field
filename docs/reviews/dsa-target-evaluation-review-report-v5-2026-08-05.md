# DSA target evaluation review report v5 — 2026-08-05

## Outcome

Report v5 is an additive reviewer-only recomputation over numeric AIPAC candidate v3. It preserves the unchanged `dsa-primary-target-v0.1` formula, the August 4 production projection, tenure candidate, report-v2 comparison baseline, and certified Washington top-two authority. It does not approve a mapping or methodology, publish a factual input, change the production release, or replace report v4.

| Metric | Report v4 | Report v5 | Change |
|---|---:|---:|---:|
| Numeric-complete candidate seats | 206 | 211 | +5 |
| Evaluator-complete AIPAC seats | 198 | 201 | +3 |
| Pending mapping seats | 6 | 1 | -5 |
| Current-cycle not-applicable seats | 0 | 2 | +2 |
| Candidate evidence groups | 274 | 278 | +4 |
| Evidence groups used | 260 | 261 | +1 |
| Seats with candidate evidence | 124 | 127 | +3 |
| Seats with evidence used | 118 | 119 | +1 |
| AIPAC route selections | 52 | 52 | unchanged |
| Partial qualified / not qualified | 140 / 72 | 140 / 72 | unchanged |

MD-04 now uses its already valid 2022 UDP opposition-to-challenger group. The group yields an AIPAC component of 45, but the seat's stronger deep-blue route still wins, so its rank remains 16. MN-03 and NY-04 become evaluator-complete with explicit zero-evidence AIPAC components; their selected routes and ranks do not change. CA-31 remains unscored because 2024 is pending.

## Not-applicable scoring firewall

MA-06 and NH-01 retain their factual 2022/2024 evidence in numeric v3, but their 2026 House coverage is `not_applicable_no_house_candidacy`. Formula v0.1 requires all three cycles and both channels to be complete and has no not-applicable denominator. Report v5 therefore gives both seats a null AIPAC component and no AIPAC-supported route rather than converting 2026 to a completed zero. MA-06 retains its deep-blue route at rank 129; NH-01 remains unranked.

Changing that denominator would require a separately versioned scoring model and reviewer decision. It is not inferred as part of this numeric correction.

The eight Washington seats remain formula-incompatible under their retained top-two authority. Their candidate evidence remains upstream but is not used by the evaluator. Every incomplete, not-applicable-current-cycle, or formula-incompatible row is checked to have a null AIPAC component and no AIPAC-supported route.

## Reproduction

```bash
npm run generate:dsa-target-review-v5
npm run test:run -- src/domain/dsa-target-review-report-v5.test.ts
npm run typecheck
npm run data:verify
```

Artifact: `data/metadata/dsa-target-evaluation-review-report-20260805-v5.json`

- Artifact SHA-256: `c12fa569c15e6752f7fd788331ebd7753963f88616956db4429f5b65fd459ee5`
- Report SHA-256: `10829503f5982014abcba4d8b0eb6238a7710ba273f14f9579324f0493b3509f`
- Status: `proposed`
- Reviewer: null
- Publication eligible: false

The successor reviewer package must keep the sole CA-31/2024 precedence decision, three methodology/model decisions, and publication promotion distinct. No decision is resolved by this report.
