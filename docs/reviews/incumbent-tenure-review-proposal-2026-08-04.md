# Incumbent tenure review proposal — 2026-08-04

## Decision

Retain the cumulative House-service derivation and reviewer report v2 as proposed, reviewer-only evidence. Use the 212 tenure values only under the package's reversible default, `use_in_reviewer_only_evaluation_exclude_from_publication`. Do not publish the candidate, expose v2 through an application route, or call its methodology approved while the decision remains unresolved.

## Exact source and universe

The retained source is the exact `snap_full_legislators` byte artifact already approved in production release `rel_full_20260804_v2`:

- source: `https://unitedstates.github.io/congress-legislators/legislators-current.json`
- retrieved: `2026-08-04T18:20:00.000Z`
- parser: `congress-legislators-json-v1`
- license: `CC0-1.0`
- bytes: 1,466,894
- SHA-256: `bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf`

The read-only production roster export binds the published release manifest, approved snapshot record, and exact 212 occupied regular Democratic voting House seats. Every seat maps to one unique BioGuide identity and at least one recorded House term. The roster file SHA-256 is `8ae9bb3423e6160d00b5395186c42550e28811b817a482650875d87de71079e1`; its domain-separated roster hash is `cf068848595dee99882ae74a6bef2b76061597fe0daa3c86b30c71bdcae18fee`.

## Methodology and audit result

The selected candidate metric is cumulative recorded House service:

1. Include `rep` terms only. Exclude Senate and nonvoting-delegate service.
2. Treat source start dates as inclusive and end dates as exclusive. Include the 2026-08-04 cutoff day by clipping current terms to exclusive boundary 2026-08-05.
3. Sum only the recorded service intervals. Never count a gap out of office.
4. Follow the stable BioGuide person identity when district or state assignments change.
5. Divide cumulative service days by 365.2425 and round to six decimal places for the evaluator value.
6. Preserve first-service and current-uninterrupted dates in the candidate package for audit, while serializing only the value, fact hash, method, and candidate status into report v2.

The exact candidate contains 212 values from 1,251 House terms, nine careers with a break longer than 30 days, 50 careers with a district/state transition, and zero prior delegate careers. As a decisive regression case, Cleo Fields has a 10,227-day interval out of office: the candidate counts 5.577117 years of recorded House service rather than 33.580429 elapsed years since first service.

Candidate file SHA-256 is `18e8fc5a7496362efdb33d07a2012063c2a2062ddb14c5b8605dbbebb28db867`; its domain-separated package hash is `7d916948a8f827a95882e66713e0816cc031d48877495635ed9912cdf16f4473`.

## Reviewer report v2

Report v2 is additive; immutable v1 is not regenerated or overwritten. V2 binds the production projection, tenure candidate, and the same four excluded AIPAC proposals. It supplies tenure to the evaluator as `derived_candidate` under the reviewer-only default, removes `incumbent_tenure` from missing facts, and preserves all other missingness.

Exact v2 result:

| Measure | Count |
| --- | ---: |
| Eligible seats | 212 |
| Cash values / missing | 210 / 2 |
| Tenure candidate values / missing | 212 / 0 |
| Partial deep-blue qualified / not qualified | 117 / 95 |
| AIPAC numeric evidence rows | 0 |
| AIPAC route selections | 0 |

The qualification count is unchanged because tenure affects primary feasibility, not the presidential-margin route threshold. Scores and ranks do change. The leading v2 rows are:

| Partial rank | Seat ID | Target score | Blue baseline | Feasibility | Tenure years |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | `seat_house_il_01_current` | 90.9 | 100.0 | 69.5 | 3.586658 |
| 2 | `seat_house_nc_04_current` | 90.9 | 100.0 | 69.5 | 3.586658 |
| 3 | `seat_house_ny_16_current` | 89.7 | 100.0 | 65.6 | 1.585248 |
| 4 | `seat_house_ga_05_current` | 88.9 | 100.0 | 63.1 | 5.585330 |
| 5 | `seat_house_tx_18_current` | 88.9 | 100.0 | 62.9 | 0.503775 |

Report file SHA-256 is `05d7d59ac91eb4987dc5784fb158e3b2501b3b41c9bba336523c4182a2a01e6e`; its domain-separated report hash is `63a057b7832efd4c0bac4896dda94432996c9c04a95952084c631f32d8b0227d`.

## Reproduction and checks

```bash
npm run generate:incumbent-tenure-candidate
npm run generate:dsa-target-review-report-v2
npm test -- --run src/ingestion/identity/incumbent-tenure-factual-candidate.test.ts src/domain/dsa-target-review-report-v2.test.ts
npm run data:verify
```

Both generators use exclusive-create semantics: an existing byte-identical artifact is accepted, while a differing artifact is never overwritten. The v2 generator independently re-hashes the production projection, tenure candidate, production roster, and all four AIPAC proposal inputs against the source lock. It validates the roster/candidate/release-manifest join and fails closed unless the tenure decision has the exact unresolved reviewer-only default.

## Remaining decision and work

One reviewer decision remains: accept cumulative recorded House-service days divided by 365.2425 as the incumbent-tenure factor, choose a documented alternative, or keep tenure missing. The recommendation is cumulative service because it counts only recorded House service, excludes time out of office, and remains stable across district changes. Resolving this decision may authorize a future reviewed evaluator input, but publication still requires the report's independent release and public-interface gates.

The next factual completeness block remains nationwide prior-primary results and filing deadlines. The retained 2020 presidential candidate also remains excluded pending its two independent decisions. AIPAC scoring remains blocked on review and exact transaction-route approval; no mechanism in this slice promotes those proposals.
