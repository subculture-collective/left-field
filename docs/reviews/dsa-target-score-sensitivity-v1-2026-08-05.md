# DSA target score sensitivity candidate v1

Status: **proposed reviewer-only robustness analysis; not a formula revision, approval, release, or deployment**.

This candidate binds the exact numeric-v4, report-v6, and review-package-v4 bytes and recomputes only declared route aggregation or evidence-window alternatives. The bound review package proves that decision `aipac-numeric:accept-v01-score-contract-v4` remains unresolved; this artifact informs that existing decision and does not replace or resolve it. Its 60/25/15 control reproduces every baseline route score, selected route, target score, and rank across all 212 seats. Formula `dsa-primary-target-v0.1`, report v6, the published release, and the public application remain unchanged.

## Weight sensitivity

| Scenario | AIPAC / blue / feasibility | Qualified | AIPAC route | Route changes | Mean absolute rank change | Maximum rank change | Top-10 overlap | At least 10 ranks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline control | 60 / 25 / 15 | 140 | 52 | 0 | 0 | 0 | 10 | 0 |
| Lower support stress | 40 / 40 / 20 | 140 | 52 | 0 | 6.0 | 28 | 7 | 26 |
| Higher support stress | 75 / 15 / 10 | 140 | 53 | 1 | 8.6 | 52 | 9 | 46 |

These are descriptive robustness results, not empirical calibration, causal evidence, or a claim that one vector is politically correct. The unchanged qualification counts coexist with material rank movement, so route counts alone are insufficient evidence of model stability.

## Denominator sensitivity

The default remains fixed six-cell exclusion: all direct and independent channels for 2022, 2024, and 2026 must be complete. Not-applicable or unavailable cells remain null and are never filled with zero.

- MA-06 and NH-01 receive separate 2022/2024 four-cell diagnostic values while their 2026 cells remain `not_applicable_no_house_candidacy`. Those diagnostics are explicitly nonrankable and cannot select a route.
- The comparative alternative applies the same 2022/2024 four-cell window to every seat and excludes 2026 evidence and coverage everywhere. It retains v0.1's declared 2026 analysis anchor solely for evidence recency, so 2024 evidence receives weight `0.7` and 2022 evidence receives weight `0.45`. It is labeled `dsa-primary-target-history-window-sensitivity-v1`, not v0.1. It produces 139 qualifications, 35 AIPAC routes, 17 route changes, one qualification change, 80 movements of at least ten ranks, and top-10 overlap of seven.
- Washington rows remain eligible for the independent deep-blue route, but their AIPAC-route component is null under the formula-incompatible top-two contract. The exclusion label is deliberately route-specific.
- No scenario zero-fills missing, unavailable, pending, not-applicable, or formula-incompatible inputs. CA-31's zero remains valid only because its six-cell evidence matrix is complete and contains no qualifying match.

## Decision support

The observed robustness evidence supports the bound review-package-v4 recommendation to retain 60/25/15 and fixed six-cell exclusion. A different weight or common-history denominator requires a separately versioned formula candidate and regenerated evaluation report. This is evidence for the existing unresolved scoring-contract decision: the sensitivity artifact contains no independent decision ID, decision hash, review lifecycle, or publication-block flag, and creates no fifth decision. Methodology selection does not authorize promotion; publication remains a distinct unresolved decision.

The artifact-level resolution, reviewer, and review-time fields remain null. The exact bound upstream scoring decision also remains unresolved.

## Reproduction and immutable identities

```bash
npm run generate:dsa-target-score-sensitivity-v1
npm run test:run -- src/domain/dsa-target-evaluator.test.ts src/domain/dsa-target-review-report-v6.test.ts src/domain/dsa-target-score-sensitivity-v1.test.ts
npm run data:verify
```

- Artifact: `data/metadata/dsa-target-score-sensitivity-candidate-20260805-v1.json`
- Artifact SHA-256: `0b030411dea9ab8625a1722a8d014e81a7836a47b9215b39ca51311353604197`
- Package SHA-256: `e609c49c0ae71bb79df50d373c70cbecd96cff1a4891ee7c8a9577c8c0dfba5e`
- Scenario-set SHA-256: `8585674546314f305bdd9a69145f4ecdaed158471efbf68792717ac150a5504f`
- Common-history row-set SHA-256: `300ee7d846f516c87b4b8c3289160fc5bbb2f569697af000effa219e6a5e9a93`
- Common-history scenario SHA-256: `406b99319469916bf92cd6ab307d51658f7cefa256864a965025781131f3f703`
- Existing decision informed: `aipac-numeric:accept-v01-score-contract-v4` (unresolved in the exact bound review package)
