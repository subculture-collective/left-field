# AIPAC evidence foundation candidate v2 — 2026-08-05

## Outcome

Foundation v2 is an additive reviewer-only overlay on the immutable v1 relationship universe. It does not rebuild mappings from mutable discovery inputs and does not rewrite any v1 candidate ID, cycle, authorized committee, provenance label, or relationship hash.

- All 229 signed v1 relationship objects are nested unchanged.
- The Illinois 7 `H0IL07167` relationship receives the signed mechanical `challenger_auto_accepted` disposition and becomes the 222nd reviewer-only usable candidate relationship.
- The California 47 `H0IL07167` relationship receives `challenger_auto_rejected` because its only origin was a negative adjustment. Rejection is not evidence of complete zero spending.
- The six incumbent conflicts receive their complete signed proposed-resolution rows, but remain `incumbent_pending_authorized_review` and excluded.
- The concise mapping queue now contains those six pending incumbent decisions. The three methodology choices and separate promotion choice remain outside this relationship-foundation queue.
- Numeric evidence rows and evaluator route selections remain zero.

## Counts

| State | Count |
|---|---:|
| Signed source relationships | 229 |
| Inherited direct relationships | 206 |
| Inherited inferred relationships | 15 |
| Challenger relationships automatically dispositioned | 2 |
| Reviewer-only usable relationships | 222 |
| Pending incumbent-resolution relationships | 6 |
| Rejected invalid origins | 1 |
| Remaining mapping decisions | 6 |
| Separate methodology and promotion decisions | 4 |

## Safety contract

The generator pins the raw file hashes of foundation v1 and both resolution artifacts, validates all three internal packages, requires a common August 4 source cutoff, and partitions the exact eight-row v1 conflict universe without overlap or omission. Each v2 row wraps the entire signed v1 row and one strict resolution union. Domain-separated hashes bind every wrapper, the relationship set, decision set, and package.

The incumbent proposal payload may show corrected canonical IDs, committee relationships, the raw `DFL` party treatment, a source-scoped California override, or a 2026 Senate transition. Those facts remain nested proposals. They do not replace the signed v1 relationship fields without a later authorized acceptance artifact.

Downstream numeric work must recognize all three noneligible states—pending resolution, invalid origin, and not-applicable House cycle. None may become `complete_no_matching_evidence` merely because a committee list is empty or a relationship was rejected.

## Reproduction

```bash
npm run generate:aipac-evidence-foundation-v2
npm run test:run -- src/ingestion/fec/aipac-evidence-foundation-candidate-v2.test.ts
npm run typecheck
npm run data:verify
```

Artifact: `data/metadata/aipac-evidence-foundation-candidate-v2.json`

Foundation v2 remains `reviewerOnly: true`, `publicationEligible: false`, and absent from the public release. It changes no score, route selection, deployed data, or reviewer approval state.
