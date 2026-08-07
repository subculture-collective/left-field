# Maine current-incumbent primary identity candidate v1 — 2026-08-07

## Outcome

This reviewer-only candidate joins the six retained ME-01 and ME-02 primary observations to the two current roster identities. It proposes five high-confidence relationships: two exact reordered Chellie Pingree name observations and three documented derived relationships covering Pingree's source-only middle initial and Jared Golden's full `Forrest` middle name. Those five source rows contain 266,438 votes.

The 2026 ME-02 row is an explicit non-link. Jared Golden does not appear in the four-candidate source contest, so the row retains the contest and RCV result evidence while keeping the linked source candidate and votes null. No relationship is approved, selected, score-eligible, published, or deployed; historical geography remains separate and unapproved.

## Identity evidence

- Current ME-01 is bound by roster, House Clerk, and Congress Legislators to BioGuide `P000597` and official name `Chellie Pingree`. `Pingree, Chellie` and `PINGREE, CHELLIE` are exact after deterministic case and comma-order normalization. `Pingree, Chellie M.` is derived rather than exact: the finite rule permits the otherwise undocumented one-letter source middle token only with exact first name, last name, district, and unique candidate closure.
- Current ME-02 is bound by the same three authorities to BioGuide `G000592` and House official name `Jared F. Golden`. Congress Legislators independently retains first `Jared`, middle `Forrest`, and last `Golden`, so `Golden, Jared Forrest` is a documented full-middle-name relationship rather than fuzzy matching.
- Maine's workbooks provide no durable person identifier or BioGuide bridge. All six rows therefore retain `directIdentifierBridgeAvailable: false`.

## 2026 ME-02 and ranked-choice boundary

The reported contest remains present with four candidates, 78,724 named workbook first choices, 4,756 blank votes, and 83,480 total ballots. The central-count summary explicitly names Matthew G. Dunlap as the RCV winner. That result fact is not Jared Golden identity evidence and does not replace the current roster identity.

The row preserves a null source candidate and null linked votes, `current_incumbent_not_observed_in_source_candidate_set`, the explicit Dunlap source-winner marker, and the 81-vote difference between workbook and central-count round-one named-candidate projections. It does not conclude zero votes, retirement, withdrawal, primary defeat, nominee status, or source precedence. Later RCV rounds are not converted into an ordinary primary-margin evaluator value.

The five single-candidate workbooks still have `not_marked_by_source`; candidate count, vote rank, and `FINAL` filenames create no winner, uncontested, or nomination inference.

## Provenance and lifecycle

The exact direct parents are the current target roster, the unresolved source-selection proposal, House Clerk XML, Congress Legislators snapshot, and the Maine primary-result receipt. The six workbooks and RCV text remain transitive receipt inputs. The package informs `approve-historic-primary-candidate-identity-resolution-v1` but does not resolve it or create an independent decision.

All identity, historical geography, ranked-choice disposition/formula, classification, human-review, scoring, publication, and deployment gates remain open.

## Immutable pins

- artifact bytes: `21612`
- file SHA-256: `1f0f95696754675439438901679256f875e3612185bf66265f244419ad775474`
- package SHA-256: `d3defe9629eb9b79cf1cf5c7672aee783a85e912d1b563a8277b893fda1f6fd3`
- observation-set SHA-256: `439adc45936c851bcf73e941702bd653e7067842b6ffd4cb20dac8f769feadd1`

## Reproduction

```bash
npm run generate:me-current-incumbent-primary-linkage-v1
npx vitest run src/ingestion/elections/maine-house-democratic-primary-results-receipt.test.ts src/ingestion/elections/maine-current-incumbent-primary-linkage-candidate.test.ts
npm run typecheck
npm run data:verify
npm run lint
```

The generator is create-only and byte-deterministic. The validator pins exact parent metadata, source facts, row schema, row/set/package hashes, and lifecycle state. Fully rehashed adversarial cases reject a fabricated Dunlap-to-Golden link, Golden identity promotion, winner inference, altered RCV facts or totals, approvals, reviewer resolution, evaluator fields, publication, and unknown fields.
