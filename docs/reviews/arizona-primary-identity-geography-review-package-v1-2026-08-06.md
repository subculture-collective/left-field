# Arizona primary identity/geography review package v1

Date: 2026-08-06  
Status: proposed reviewer queue; no decision approved, rejected, corrected, published, or deployed

## Joined review records

The package joins the exact six current-target identity observations one-to-one with their geography rows for Arizona districts 03, 04, and 07 across 2022 and 2024.

| Review category | Records | Meaning |
| --- | ---: | --- |
| Identity and geography candidates | 3 | Both relationships are independently proposed and unapproved. |
| Geography candidate, identity unresolved | 3 | The 2022 district 03 and both district 07 rows retain geography candidates while keeping their predecessor candidates unlinked from current incumbents. |

All six records preserve certified statewide-canvass authority, with the 2024 district 03 final recount and court-order revision retained separately. Source winner markers remain source facts only. No marker becomes identity evidence, review approval, evaluator selection, progressive classification, or a score.

## Five independent proposed decisions

| Decision | Evidence rows | Recommendation |
| --- | ---: | --- |
| Accept certified canvass/recount authority | 6 | Accept retained 2022/2024 authority as a source-status fact only; do not promote records or resolve other gates. |
| Accept geography compatibility | 6 | Accept three CD118→CD119 continuity and three exact CD119-key candidates without claiming raw geometry equality. |
| Accept identity links | 3 | Accept the three exact links while retaining the Gallego and Raúl Grijalva observations as no-matches. |
| Retain primary-disposition exclusion | 6 | Preserve source winner markers without letting this join select an evaluator candidate or infer progressive classification. |
| Retain progressive-classification exclusion | 6 | Keep classification and progressive-primary factors excluded because these parents contain no reviewed ideological evidence. |

Each decision has two alternatives, two consequences, a reversible exclusion default, high confidence, exact evidence-record IDs, `blocksAffectedPublication: true`, `blocksOtherWork: false`, and a null proposed review. One decision cannot authorize another.

## Immutable identities

- Artifact: `data/metadata/arizona-primary-identity-geography-review-package-v1.json`
- Byte size: `27,566`
- File SHA-256: `e6cf6396ff1e25deb6498eb08cb92294341596ff9bc519628997a8228d7ee420`
- Parent-projection SHA-256: `27b6c8eabdfed182c0f48960f36f0c897b200eebe6bd69d00a59c6324d154a55`
- Review-record-set SHA-256: `4dc7707e94cfd2c07c8020668f64952c9fb47006c2b84c15b8bf1dc44548f7df`
- Decision-set SHA-256: `be51d450456e9d3e21e98f18703527e47ebcbd2eccd903f19d501043653d48dc`
- Package SHA-256: `09ec4edc163ea66e7df7a6bc1382ae1fa8d509479c98ab6179bef20ad67134fb`

The exact three direct parents are the source-selection proposal, Arizona identity candidate, and Arizona geography candidate. Parent row hashes, contest hashes, review categories, result authority/revision states, decision evidence scopes, and all lifecycle-null fields are validated.

## Lifecycle boundary

The package has zero automatic or joint approvals, evaluator values, score-eligible records, published records, or deployed records. Its inherited certification, identity, geography, disposition, and progressive-classification resolutions remain null. The unofficial August 5, 2026 boundary contributes zero rows.

## Reproduction

```bash
npm run generate:az-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/arizona-primary-identity-geography-review-package.test.ts
npm run data:verify
```
