# Maryland primary identity/geography review package v1

Status: proposed reviewer queue; no decision approved, rejected, corrected, published, or deployed

## Joined review records

The package joins the exact 14 current-target identity observations one-to-one with their geography rows for Maryland districts 02 through 08 across 2022 and 2024.

| Review category | Records | Meaning |
| --- | ---: | --- |
| Identity and geography candidates | 11 | Both relationships are independently proposed and unapproved. |
| Geography candidate, identity unresolved | 3 | 2022 MD-02, MD-03, and MD-06 retain CD118→CD119 continuity while predecessor candidates remain unlinked from current incumbents. |

All 14 records preserve `state_board_official_result_candidate`, `not_independently_retained`, and `marked_by_source`. Source winner markers remain source facts only and do not create evaluator selection, identity approval, nomination approval, progressive classification, or scoring.

## Five independent proposed decisions

| Decision | Evidence rows | Recommendation |
| --- | ---: | --- |
| Retain State Board result authority with certification exclusion | 14 | Accept scoped State Board result authority while retaining that separate final certification is not independently retained. |
| Accept geography compatibility | 14 | Review seven CD118→CD119 continuity and seven exact CD119-key candidates without claiming raw geometry equality. |
| Accept identity links | 11 | Review six exact and five finite derived links while retaining three 2022 predecessor no-matches. |
| Retain primary-disposition exclusion | 14 | Keep source winner markers factual but nonauthorizing; infer no evaluator selection or numeric primary factor. |
| Retain progressive-classification exclusion | 14 | Keep progressive-primary factors excluded because these parents contain no reviewed ideological evidence. |

Each decision has a reversible exclusion default, high confidence, exact evidence-record IDs, `blocksAffectedPublication: true`, `blocksOtherWork: false`, and a null proposed review. One decision cannot authorize another.

## Immutable identities

- Artifact byte size: `49,954`
- File SHA-256: `20224dd8cf7224f14cfaf94827c65d5e306d3bab3a7b4dc25515396e6fd9091a`
- Parent-projection SHA-256: `d9cbe64445e110f5129f61b25063d58972e8c38138fd97c22b056a0731abf345`
- Review-record-set SHA-256: `c25e71331916e2b47ef0841ca36658ca7d24583f854b66ed0e883d57f57edf6f`
- Decision-set SHA-256: `6564b7beea241c673e61b6c9da7f175ac20b57b3c00d5d135c7f337bfd0f2674`
- Package SHA-256: `9c58994d92156fa552fdfe8b8c3f4259dc47d130404001948694eda688213074`

The exact three direct parents are the source-selection proposal, Maryland identity candidate, and Maryland geography candidate. Parent row hashes, contest hashes, review categories, decision evidence scopes, and all lifecycle-null fields are validated.

## Lifecycle boundary

The package has zero automatic or joint approvals, evaluator values, score-eligible records, published records, or deployed records. Its inherited authority/certification, identity, geography, disposition, and progressive-classification resolutions remain null. No 2026 row exists.

## Reproduction

```bash
npm run generate:md-primary-joint-review-v1
npx vitest run src/ingestion/elections/maryland-primary-identity-geography-review-package.test.ts
npm run data:verify
```
