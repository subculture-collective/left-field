# Washington primary identity/geography joint reviewer package v1

Status: proposed reviewer queue; no decision approved, rejected, corrected, published, or deployed

## Joined review records

The package joins all 16 Washington current-target identity observations one-to-one with their geography rows across the certified 2022 and 2024 top-two contests.

| Review category | Records | Meaning |
| --- | ---: | --- |
| Identity and geography candidates | 15 | Thirteen exact and two bounded middle-initial identity links are paired with independently proposed geography candidates. |
| Geography candidate, identity unresolved | 1 | 2022 WA-06 retains CD118→CD119 continuity while predecessor Derek Kilmer remains unlinked from current incumbent Emily Randall. |

Every record preserves `certified`, `top_two`, `confirmed_incompatible`, and `sourceWinnerStatus: not_established`. Party preference remains source text, not nomination or endorsement. Certification and the join establish no source winner, advancement, evaluator selection, progressive classification, or score.

## Five independent proposed decisions

| Decision | Evidence rows | Recommendation |
| --- | ---: | --- |
| Retain certified top-two result authority | 16 | Retain certified contest facts without converting them into Democratic-primary facts. |
| Accept geography compatibility | 16 | Review eight CD118 continuity and eight exact CD119-key candidates without claiming raw geometry equality or overlap. |
| Accept identity links | 15 | Review 13 exact and two finite middle-initial links while preserving 2022 WA-06 as an explicit no-match. |
| Retain top-two formula exclusion | 16 | Preserve the independently sourced `top_two_non_nominating` and `confirmed_incompatible` exclusion with all evaluator values null. |
| Retain progressive-classification exclusion | 16 | Keep progressive-primary factors excluded because these parents contain no reviewed ideological evidence. |

Each decision has a reversible exclusion default, high confidence, exact evidence-record IDs, `blocksAffectedPublication: true`, `blocksOtherWork: false`, and a null proposed review. One decision cannot authorize another.

The formula decision is bound to its actual owner, `filing-runway-exception-authority-proposal-20260804-v1`, rather than being attributed to the general primary source-selection proposal. The authority independently retains the Washington state record as `top_two_non_nominating`, `confirmed_incompatible`, and evaluator-ineligible, with decision `exclude-washington-top-two-from-partisan-primary-v01` unresolved.

## Immutable identities

- Artifact byte size: `53,116`
- File SHA-256: `127196d44d5d4f17420d74f61b2615e5bf2dcc4d4c057d1b0cabfc4cffa375cf`
- Review-record-set SHA-256: `eda33d9f555eb715deffb7625537bd442ccdfc166b7963b9d97acfe957d86e1f`
- Decision-set SHA-256: `44d619125b57e8b2a10446fddb84240dddc50f95222c33d66a8cc281b2d16013`
- Package SHA-256: `c7b6691c27756bc62a241015392fa5bf6a51ee8b5e806188ccfd172f8e1bc7a8`

The exact four direct parents are the primary source-selection proposal, filing-runway exception authority, Washington identity candidate, and Washington geography candidate. Parent row hashes, contest hashes, review categories, decision evidence scopes, and all lifecycle-null fields are validated.

## Lifecycle boundary

The package has zero automatic or joint approvals, evaluator values, score-eligible records, published records, or deployed records. Result-authority, identity, geography, formula/disposition, and progressive-classification resolutions remain null. No 2026 or CD120 row exists.

## Reproduction

```bash
npm run generate:wa-primary-joint-review-v1
npx vitest run src/ingestion/elections/washington-primary-identity-geography-review-package.test.ts
npm run data:verify
```
