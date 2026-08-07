# Minnesota House DFL primary results receipt

Date: 2026-08-06
Status: proposed reviewer-only evidence; not approved, score-bearing, published, or deployed

## Result

The receipt retains the complete source-native DFL U.S. House corpus exposed by the Minnesota Secretary of State flat files for the 2022 and 2024 state primaries: 12 contests, 28 candidate rows, and 593,199 votes. All candidate totals reconcile exactly to the source contest totals, all reported contests show complete precinct reporting, and candidate names are cross-checked against the separate official candidate tables.

The target surface is deliberately narrower: MN-02, MN-03, MN-04, and MN-05 across both historical cycles. Five of those eight district-cycle observations have portal-reported DFL contests. Three are absent from the source files and remain unresolved—not zero votes, no primary, an uncontested race, or a nominated candidate.

| Cycle | Primary identity | Target districts reported | Target districts absent from source |
| --- | --- | --- | --- |
| 2022 | August 9; election ID 148 | MN-04, MN-05 | MN-02, MN-03 |
| 2024 | August 13; election ID 169 | MN-02, MN-04, MN-05 | MN-03 |
| 2026 | August 11, derived from Minn. Stat. § 204D.03 | none; event not held at cutoff | no result rows created |

The old nationwide feasibility matrix is scoped to presidential general elections; its Minnesota election ID 170 is therefore not reused as a primary identifier.

Artifact: `data/metadata/minnesota-house-democratic-primary-results-2022-2026-v1.json`

Artifact SHA-256: `8ccf5fb90e7851e62a953a3e211db55fad0e5891b9178ff8186de0abf5b827d2`

Package SHA-256: `336094811277f867f5370b53f7b8568733a73a3d2c45b7fa4e5faa3071866e84`

Source-contest-set SHA-256: `7c1b8fbf54488fa9d90a6598b9fa322e097ceea40e6d4fc6ec28b41d7be86ec5`

Target-observation-set SHA-256: `8c373fa281d18f7bc686c168fc2b3c10cf75039cc7da54138d3f0b68fa92404d`

## Certification boundary

The retained official-document records identify the event-level canvass instruments:

- 2022 document 224057 is the State Canvassing Board certificate and canvassing report, dated August 16, and describes votes taken from certified county abstracts for the August 9 primary.
- 2024 document 20242807 is the State Canvassing Board certificate for state-primary declarations covering state and federal partisan and judicial offices, dated August 20.

The exact attached report/tabulation bytes are not exposed in the retained pages and were not obtained. The receipt therefore does not claim that its flat-file bytes are certified returns, that the canvass record certifies each retained candidate row by name, or that either record is an individual contest certificate. Result rows are labeled `official_portal_reported_result_not_claimed_as_certified_result_bytes`.

The 2024 official media-layout page says election-night reports may change after initial reporting. The source marks no winner in the retained fields, so the receipt makes no vote-rank winner inference. It preserves Minnesota's raw `DFL` code rather than silently normalizing it to `DEM`.

## Absence and statutory rule

The retained current Minnesota Revisor page for § 204D.03 supplies two bounded facts: the state primary occurs on the second Tuesday in August in even-numbered years, and some major-party offices with no more than one filer may be declared and omitted from the primary ballot. This supports the derived August 11, 2026 date and demonstrates why source absence is ambiguous. It does not establish how many candidates filed in any absent district.

No express reuse license or public-domain declaration was found in the retained election pages. The package keeps official attribution and direct URLs and remains behind legal/human review before publication or redistribution decisions.

## Reviewer decisions and safe default

This package informs, but does not resolve, the existing decisions `collect-official-state-primary-results-and-certification-v1` and `decide-nonstandard-primary-disposition-treatment-v1`.

Recommended disposition:

- accept the exact flat files as authoritative portal-reported observations with complete arithmetic closure;
- accept document numbers 224057 and 20242807 only as event-level canvass-record metadata;
- preserve all three target source absences as unresolved pending filing/ballot or exact canvass evidence;
- preserve source winner status as unmarked and keep identity, historical geography, progressive classification, contest selection, evaluator values, and publication independently gated.

Safe default if the reviewer chooses differently: exclude every Minnesota row from the evaluator and public release. The package already applies that default: reviewer and resolution are null, all evaluator values are null, all eight target observations are unselected and score-ineligible, and `publicationEligible` is false.

## Deterministic controls

The importer validates all eleven exact input byte lengths and SHA-256 values before writing any destination. Its adversarial test proves a drifted final input leaves no partial `data/` tree. The retained 2022 media index independently exposes election ID 148 and directly links the exact U.S. House and candidate-table URLs. Sources without a retained direct-navigation relation remain independent roots rather than receiving an invented parent. The builder validates exact source IDs, URLs, paths, parent topology, primary event identities, official-page text, statutory text, raw DFL rows, candidate-table agreement, precinct closure, vote reconciliation, parent decisions, row hashes, set hashes, and package hash. Semantic validation rejects lifecycle escalation even after an attacker recomputes the affected row and package hashes.

```bash
MN_PRIMARY_IMPORT_DIR=/path/to/exact-capture npm run import:mn-house-primary-results
npm run generate:mn-house-primary-results-receipt
npm run test:run -- src/ingestion/elections/minnesota-house-democratic-primary-results-receipt.test.ts
npm run typecheck
npm run data:verify
make check
```
