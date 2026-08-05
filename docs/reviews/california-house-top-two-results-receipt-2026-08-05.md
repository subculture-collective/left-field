# California House top-two results receipt

Status: **proposed reviewer-only factual package; formula-incompatible, not approved, published, or evaluator-eligible**

Source cutoff: **2026-08-05**

## Retained scope

The receipt retains all 52 U.S. House district contests from each California Secretary of State certified primary Statement of Vote for June 7, 2022, March 5, 2024, and June 2, 2026.

Artifact: `data/metadata/california-house-top-two-results-2022-2026-v1.json`

| Cycle | Contests | Candidate rows | Write-ins | Source incumbent markers | Reconciled votes |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2022 | 52 | 272 | 8 | 0 | 6,896,731 |
| 2024 | 52 | 245 | 4 | 45 | 7,283,233 |
| 2026 | 52 | 297 | 8 | 0 | 8,827,913 |
| **Total** | **156** | **814** | **20** | **45** | **23,007,877** |

Every district total is the sum of all source candidate rows, including write-ins. Every supplied one-decimal percentage reconciles to the retained candidate vote and district total within the source's rounding tolerance.

## Top-two boundary

California identifies U.S. congressional offices as voter-nominated offices. All candidates appear on one ballot and the two highest vote-getters advance regardless of party preference. A candidate's party-preference label is not a party nomination or endorsement.

The package therefore records:

- `nominationSystem: top_two_open_primary`
- `partyFieldMeaning: candidate_qualified_party_preference`
- `formulaApplicability: confirmed_incompatible_with_party_primary_metrics`
- `selectionStatus: excluded_formula_incompatible`
- zero Democratic-primary evaluator values and zero score-eligible contests

The receipt does not aggregate `DEM` preference rows into a Democratic primary vote total, does not call the highest vote-getter a Democratic winner, and does not derive top-two advancement. A separately reviewed top-two-aware factor contract is required before evaluator use.

## Certification and 2024 district 16

The retained Secretary certificates identify each statewide Statement of Vote as a full, true, and correct statement of the official canvass. The 2026 certificate is signed and sealed July 10, 2026, so the complete June 2 event is official and within the August 5 cutoff.

The 2024 district 16 contest separately retains the Secretary's May 10 recertification after the voter-requested recount. Its official workbook values are Evan Low 30,261 and Joe Simitian 30,256. Only that contest receives `certified_statement_of_vote_with_cd16_recertification`; the recertification is not generalized to other districts.

## Workbook extraction boundary

The exact XLSX and human-readable PDF are retained for each cycle. The normalized candidate-total extract is generated from workbook cells with `openpyxl 3.1.5`, not OCR. For 2022 and 2024, the visible `Representative in Congress` sheet supplies the structured values. The 2026 workbook also includes a `Working Data` sheet; that aligned source table is authoritative for extraction because several continuation columns in the presentation sheet are visually shifted. For example, 2026 district 4 correctly retains Ray Riehle 42,883, Chuck Uribe 7,235, and Thomas M Roach 1,527, for a 206,887-vote contest total.

The extraction script fixes exact candidate counts, vote totals, district closure, candidate order, write-in flags, incumbent-marker flags, and percentage reconciliation. The source PDFs remain an independent visual representation, while signed certificates establish official-canvass status.

## Lifecycle boundary

This source lock proves exact retained official inputs, a deterministic normalized extract, and a reproducible proposed package. It is not reviewer approval or publication. Candidate identity, historical geography compatibility, ideology, current incumbency, and top-two evaluator applicability remain unreviewed. The source incumbent asterisk is retained only as the source's 2024 marker and is not promoted into current identity.

The package supports the existing official-primary-source and nonstandard-disposition decisions. It creates no new decision, resolves neither one, and exposes no public score.

## Reproduction and validation

```sh
python -m venv .venv-ca-primary
.venv-ca-primary/bin/python -m pip install -r requirements-ca-primary-extraction.txt
export PATH="$PWD/.venv-ca-primary/bin:$PATH"
CA_PRIMARY_IMPORT_DIR=/path/to/exact-download-bundle npm run import:ca-house-top-two-results
npm run extract:ca-house-top-two-results
npm run generate:ca-house-top-two-results-receipt
npm run test:run -- src/ingestion/elections/california-house-top-two-results-receipt.test.ts
npm run data:verify
npm run typecheck
```

Normalized extract SHA-256: `94f110f4cef4ac2f7d8fd32e7765318372a81280fcf2995b7ca1563a1f59bebc`

Package SHA-256: `554eaaa45f2fe80decbcb078579470e72e76673b2356c17bb8a6283af4460e72`

Contest-set SHA-256: `39c1fce31143fad62a01704ed6238b5493e460a6317075b6135b112e47524eb8`
