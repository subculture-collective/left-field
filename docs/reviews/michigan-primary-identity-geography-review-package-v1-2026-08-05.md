# Michigan primary identity/geography review package v1

Date: 2026-08-05
Status: proposed reviewer queue; no decision approved, rejected, corrected, published, or deployed

## Joined review records

The package joins the exact 12 current-target identity observations one-to-one with their geography rows for Michigan districts 03, 06, 08, 11, 12, and 13 across 2022 and 2024.

| Review category | Records | Meaning |
| --- | ---: | --- |
| Identity and geography candidates | 11 | Both relationships are independently proposed and unapproved. |
| Geography candidate, identity unresolved | 1 | `mi-primary-joint:2022:08` retains CD118→CD119 continuity but keeps Daniel T. Kildee unlinked from current incumbent Kristen McDonald Rivet. |

All 12 records preserve official 83-of-83-county result status, retained Michigan Board of State Canvassers event-certification evidence, and `sourceWinnerStatus: not_marked_by_source`. No winner, nominee, advancement, uncontested status, identity, or score is inferred.

## Five independent proposed decisions

| Decision | Evidence rows | Recommendation |
| --- | ---: | --- |
| Accept state-board certification authority | 12 | Accept retained 2022/2024 event-certification authority as a source-status fact only; do not promote records or resolve other gates. |
| Accept geography compatibility | 12 | Accept six CD118→CD119 continuity and six exact CD119-key candidates without claiming raw geometry equality. |
| Accept identity links | 11 | Accept the seven exact and four bounded derived links while retaining MI-08 in 2022 as a no-match. |
| Retain primary-disposition exclusion | 12 | Keep reported-contest treatment; infer no winner, nominee, uncontested status, or numeric primary factor from vote rank. |
| Retain progressive-classification exclusion | 12 | Keep classification and progressive-primary factors excluded because these parents contain no reviewed ideological evidence. |

Each decision has two alternatives, two consequences, a reversible exclusion default, high confidence, exact evidence-record IDs, `blocksAffectedPublication: true`, `blocksOtherWork: false`, and a null proposed review. One decision cannot authorize another.

## Immutable identities

- Artifact: `data/metadata/michigan-primary-identity-geography-review-package-v1.json`
- Byte size: `43,193`
- File SHA-256: `95b2acf40d2464a3ad7449ccca5224785f7c4fd3edea21e4f6c70537cc4018f7`
- Parent-projection SHA-256: `c9c02b08903fd4a816ac48b4d04d100b05761a2110f4c0c88d39bf2abd3d3983`
- Review-record-set SHA-256: `6e18a5b656135b28299a2a4bd7df1a0cb9d733d37363679226716a9863f35049`
- Decision-set SHA-256: `b81b80b2eb08d377f264e9517ae3a6210c1ede459132352e5b86cf95d605f8da`
- Package SHA-256: `ee997a9bee85c4c7120403ec7b94bc510cbb63ae9bc824057a465ab96ff1c1a4`

The exact three direct parents are the source-selection proposal, Michigan identity candidate, and Michigan geography candidate. Parent row hashes, contest hashes, review categories, decision evidence scopes, and all lifecycle-null fields are validated.

## Lifecycle boundary

The package has zero automatic or joint approvals, evaluator values, score-eligible records, published records, or deployed records. Its inherited certification, identity, geography, disposition, and progressive-classification resolutions remain null. The unofficial August 5, 2026 observation contributes zero rows.

## Reproduction

```bash
npm run generate:mi-primary-joint-review-v1
npm run test:run -- src/ingestion/elections/michigan-primary-identity-geography-review-package.test.ts
npm run data:verify
```
