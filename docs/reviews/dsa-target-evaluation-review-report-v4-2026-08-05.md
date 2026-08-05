# DSA target evaluation review report v4 — 2026-08-05

## Outcome

Report v4 is an additive, reviewer-only recomputation over numeric AIPAC candidate v2. It does not approve any mapping, publish any factual input, alter the public application, or replace report v3. Its exact parents are the August 4 production projection, tenure candidate, unchanged report-v2 comparison baseline, numeric candidate v2, and certified Washington top-two authority.

| Metric | Report v3 | Report v4 | Change |
|---|---:|---:|---:|
| Numeric-complete AIPAC seats | 204 | 206 | +2 |
| Evaluator-complete AIPAC seats | 196 | 198 | +2 |
| Pending mapping blocks | 8 | 6 | -2 |
| Candidate evidence groups | 272 | 274 | +2 |
| Evidence groups used | 258 | 260 | +2 |
| Seats with evidence used | 117 | 118 | +1 |
| AIPAC route selections | 51 | 52 | +1 |
| Partial qualified / not qualified | 140 / 72 | 140 / 72 | unchanged |

Illinois 7 uses its two independently traceable UDP opposition groups, receives an AIPAC component of 85.6, selects the AIPAC route, and moves from report-v3 rank 51 to rank 46. California 47 is a complete zero-evidence seat with the rejected-origin diagnostic retained; its AIPAC component is 0, but its overall target score and rank remain null.

## Noncomplete-seat scoring firewall

The six pending incumbent mappings—CA-31, MA-06, MD-04, MN-03, NH-01, and NY-04—receive no AIPAC evidence, component, or AIPAC route selection. MA-06 and NH-01 retain proposed 2026 House-cycle inapplicability only as nonauthorizing context. It does not become a completed zero or accepted not-applicable value.

The eight Washington seats remain formula-incompatible because the retained authority confirms a top-two nomination system. Their numeric candidate evidence is retained upstream but is not used in evaluation. Every noncomplete report row is invariant-checked to have a null AIPAC component and a non-AIPAC route.

## Reproduction

```bash
npm run generate:dsa-target-review-v4
npm run test:run -- src/domain/dsa-target-review-report-v4.test.ts
npm run typecheck
npm run data:verify
```

Artifact: `data/metadata/dsa-target-evaluation-review-report-20260805-v4.json`

- Artifact SHA-256: `f50c8a445b9e0e441a67004ded8929982c1fb35b5cc0aba2bf59189b3c5da808`
- Report SHA-256: `e428fc823ab5f6efa3eacd8f5191fabcb4580a7c4775b0bcae74518917523db9`
- Status: `proposed`
- Reviewer: null
- Publication eligible: false

The current concise human-review handoff is [`aipac-numeric-review-package-v2-2026-08-05.md`](./aipac-numeric-review-package-v2-2026-08-05.md). It contains ten unresolved decisions: six evidence-specific incumbent resolutions, three methodology/model choices, and one separately gated promotion choice.
