# Illinois primary State Board certification authority receipt v1

Date: 2026-08-06
Status: official authority retained; reviewer-only scope candidate, unapproved and publication-ineligible

## Outcome

This receipt closes the missing statewide certification-authority evidence for the Illinois State Board of Elections' June 28, 2022 and March 19, 2024 general primaries. It binds the authority to the exact immutable 34-contest Illinois House Democratic primary result parent: 17 district observations per cycle, including the two explicit IL-16 `no_democratic_candidate_rows` dispositions.

The retained instruments establish that the State Board certified the results of both statewide primary elections:

| Cycle | Election | Instrument date / certification date | State Board index date | Treatment |
|---|---|---|---|---|
| 2022 | June 28, 2022 primary | July 29, 2022 | August 5, 2022 | The underlying release says the Board certified the results “today” on July 29. The later date displayed by the index is retained as a source discrepancy, not substituted for the instrument date. |
| 2024 | March 19, 2024 primary | April 19, 2024 | April 19, 2024 | Index and instrument agree. |

The 2022 discrepancy was found by inspecting the underlying official PDF rather than relying on the press-release index label. Both observations remain hash-bound in the artifact.

## Scope boundary

The receipt establishes election-level State Board certification authority. It does not claim that the repository retains an individual certificate for each congressional contest, and it does not certify a candidate by name.

Each of the 34 scope rows preserves its parent contest digest, district, disposition, candidate count, and candidate-vote total. The authority mapping changes none of those facts. It records a proposed `authorityCoverageCandidate` only; every `certificationApproved`, identity, geography, evaluator, score, publication, and deployment field remains false, null, or zero.

In particular, the receipt does not:

- select or infer a source winner;
- establish nomination or advancement by candidate name;
- change the two IL-16 no-candidate-row dispositions;
- approve incumbent identity or historical geography;
- supply progressive classification;
- create numeric evaluator values or score eligibility;
- authorize factual promotion, publication, or deployment.

The safe next step is an immutable Illinois results/joint-review v2 composition that may replace only the earlier `certificationStatus: not_retained` projection with this election-level authority candidate. Such a composition must preserve all parent contest bytes and keep authority acceptance separate from every identity, geography, classification, evaluator, and publication decision.

## Sources and artifact identity

The source lock retains the official State Board press-release index, both exact PDF instruments, and deterministic `pdftotext -layout 26.07.0` extracts. The PDFs are original authority; text files are derived validation aids.

| Field | Value |
|---|---|
| Artifact | `data/metadata/illinois-primary-state-board-certification-authority-receipt-v1.json` |
| Bytes | 33,439 |
| SHA-256 | `1c053efa0db3ea9c17fe68ea0c96dcf3e077f75770bfcdd4e6556d7bcd0f702a` |
| Package SHA-256 | `f7853562ea3d293a35a4a52dacf2866af7f8373d0217d84e5042a8220b3ccc73` |
| Contest-scope SHA-256 | `1f919084c9cf1f6ac95d0ec92e2ca1d649dd4ad920a0ceb971592e44b3597221` |

## Reproduction

```bash
npm run generate:il-primary-certification-authority-v1
npx vitest run src/ingestion/elections/illinois-primary-state-board-certification-authority.test.ts --maxWorkers=1
npm run data:verify
```
