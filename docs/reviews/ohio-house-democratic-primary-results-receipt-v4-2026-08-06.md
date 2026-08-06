# Ohio House Democratic primary results receipt v4

Date: 2026-08-06
Status: proposed reviewer-only county evidence; not approved, score-bearing, published, or deployed

## Result

V4 adds two exact county contributions to immutable v3: Fulton for OH-09 and Stark for OH-13. The county-progress layer now holds 12 of the research-derived 15 required segments, 13 candidate rows, and 192,826 candidate votes.

No 2022 district contest is emitted. The controlling Secretary of State county-composition PDF renders at its official URL, but direct retrieval still returns a Cloudflare challenge and no exact bytes are retained. The district-level target corpus therefore remains exactly ten 2024/2026 observations, 14 candidates, and 540,587 votes.

V4 creates no winner, identity, geography approval, evaluator value, score eligibility, reviewer approval, publication state, or deployment state.

Artifact: `data/metadata/ohio-house-democratic-primary-results-2022-2026-v4.json`

Artifact SHA-256: `9104931022e1fdc671f69678fe2dc4a8d8da44d087f65575ca69af16a3dd2b09`

Package SHA-256: `f8acd66b060daac23ad13c3054ff42a32c3124ea6986e356a9d82710bff1d295`

Contest-set SHA-256: `30c855938a5462946a0a7962ffc5f523a480f9875da752508810547396d8a3f7`

## Added county evidence

| County / contribution | Source and finality | Candidate votes | Source SHA-256 |
| --- | --- | ---: | --- |
| Fulton / OH-09 full county | Board index labels its May 3 link Official Results; exact wrapper points to Clarity election 112980; aggregate reports 29/29 | Marcy Kaptur 1,448 | `37fcf6413875aef655d54f68024fc8e76ba9540d3c326e5bc34804f1231a693c` |
| Stark / OH-13 partial county | Official Tabulation Results, 184/184 | Emilia Sykes 9,664 | `58de21d502f2946d81b28911eea0e7d98a854fad732f1156ee28f4380ccc576f` |

Fulton's authority chain is source-locked separately: the 40,770-byte Board results index has SHA-256 `1d1a2de563c8be754d55aa78a626a4ba7f75841c94db53b452b9b4fe844be14a`; the 633-byte Board wrapper has SHA-256 `88f3569dafed2565e17bc173a7e03ab64dd222a25d2db503e3d414e32c10353e`. The result JSON is a child of that exact chain rather than being treated as self-certifying vendor data.

## Remaining acquisition boundary

- OH-01, OH-03, and OH-11 have no missing county segment in the research matrix, but remain non-observations until the controlling geography-authority bytes are retained.
- OH-09 still needs exact retained final county totals for Defiance and Lucas. Defiance's certified precinct canvass is not summed into an inferred aggregate. Lucas's exact Board-hosted XML reports Marcy Kaptur 19,130 and 313/313 but the page explicitly says Unofficial Election Results, so it is excluded.
- OH-13 still needs Portage. Its route and document heading say official, but every indexed page footer says Unofficial SOVC; direct retrieval produced a 5,696-byte Cloudflare challenge rather than election data, so neither the challenge nor the reported Emilia Sykes 121 total is imported.
- Williams retains its inherited official-label/unofficial-footer conflict. Certification instruments, identity, historical geography, progressive classification, review, promotion, and publication remain unresolved.

## Deterministic controls

The importer accepts only the four exact source byte lengths and SHA-256 values. The builder binds the Board authority chain, Fulton aggregate, Stark tabulation, exact v3 parent file/package, 12 county segments, unchanged ten-contest parent corpus, and zero 2022 district observations. Parsers bind event, district, party, candidate, votes, official/finality context, and precinct closure. Canonical package and contest-set constants reject fully rehashed factual drift.

```bash
OH_2022_COUNTY_PRIMARY_V4_IMPORT_DIR=/path/to/exact-capture npm run import:oh-2022-county-primary-results-v4
npm run generate:oh-house-primary-results-receipt-v4
npm run test:run -- src/ingestion/elections/ohio-house-democratic-primary-results-receipt-v4.test.ts
npm run typecheck
npm run data:verify
make check
```
