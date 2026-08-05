# AIPAC numeric evidence candidate — 2026-08-05

## Disposition

This is a **reviewer-only numeric candidate**, not a reviewed factual release and not a publication input. The checked-in artifact sets `reviewerOnly: true`, `publicationEligible: false`, and `defaultUse: use_in_reviewer_only_evaluation_exclude_from_publication`. The published v2 report and public application remain unchanged.

Artifact: `data/metadata/aipac-numeric-evidence-candidate-v1.json`

- Candidate package SHA-256: `dc3f6939701930226ad7558661e14b9912b7828266133d44260ae83570a2c077`
- Retained file SHA-256: `13e07985802bc6629ea46ed1287e429c949f66b47ca0cc6f5631d963acc129b7`
- Source cutoff: `2026-08-04`
- Seats: 212
- Complete nonconflicting seats: 204
- Mapping-blocked seats: 8
- Net-positive evidence groups: 272 (256 direct AIPAC PAC, 16 UDP independent expenditure)
- Seats with evidence: 123
- Coverage cells: 1,272 (212 seats × three cycles × two channels)

## Evidence construction

The builder requires the exact retained bytes of the projection, incumbent roster, source receipts, closure package, foundation candidate, and the three official PAS2 ZIPs. It rejects any hash mismatch before parsing.

For PAS2, every AIPAC PAC row is joined by `FILE_NUM` to the cutoff-valid filing ledger. A filing is terminal only when it is not a nonterminal member of any authoritative amendment chain. Transaction revisions are then selected by cycle-scoped transaction ID at the latest terminal receipt/file. A same-file transaction ID with more than one PAS2 `SUB_ID` fails closed as ambiguous. Exact duplicates must agree on all retained economic fields, and every selected source line retains a hashed `SUB_ID`-bound source-record receipt. Memo rows and zero-value source rows are excluded; signed negative revisions remain in relationship-level netting. Evidence is emitted only for a positive net to an exact authorized committee and candidate mapping.

For UDP Schedule E, records are also restricted to terminal ledger filings before transaction selection. A repeated terminal transaction ID is accepted only as one exact Form 24/Form 3X corroboration pair; any other multiplicity or form pattern fails closed. The pair must agree on candidate, primary election, direction, amount, and expenditure date; the non-notice record is preferred for economics while both distinct `recordIdentitySha256` receipts are retained. Only primary support of a mapped incumbent or primary opposition to a same-seat mapped challenger is eligible. UDP evidence retains stable classification snapshot IDs; its parent foundation separately binds their artifact SHA-256 values.

The output contains no names, street addresses, cities, ZIP codes, employers, occupations, payees, or memo text. It retains only evaluator evidence fields, hashed source transaction identities, filing numbers, source snapshot IDs, and artifact hashes.

## Zero versus unknown

A complete nonconflicting seat has all six channel-cycle cells closed. If no qualifying positive net remains, its AIPAC component is a factual-candidate zero. The eight relationship-conflict seats have six `blocked_mapping_review` cells, no evidence, and remain unknown; none are converted to zero.

## Reviewer-only v3 evaluation

Artifact: `data/metadata/dsa-target-evaluation-review-report-20260805-v3.json`

- Report SHA-256: `a3db55181cbd0ffbe2c0b555276a5595ee37c7d233bcc30359eb2550dbcd918c`
- Retained file SHA-256: `ecea6ddb2074566069faa75db73963faff949816f69acdc71bdfd5b39b44565b`
- Candidate-complete seats: 204
- Evaluator-complete seats: 196
- Mapping-blocked seats: 8
- Formula-incompatible Washington top-two seats: 8
- Candidate evidence rows: 272; rows used by the evaluator: 258
- AIPAC route selections: 51
- Partial qualified: 140; partial not qualified: 72
- Route changes from immutable v2: 51

Washington is explicitly excluded from the AIPAC route because the current evaluation program declares a partisan-primary-general election method, while Washington uses top-two. This fence is byte-bound to the retained, certified `washington-house-top-two-results-receipt-20220802-20240806-v1` authority package (file SHA-256 `eac5df760de11a6612c2e8a95374a8041b2debb94068e0d08afadecd775963da`), which states `formulaApplicability: confirmed_incompatible`. Candidate evidence is retained, but all eight Washington seats are labeled `formula_incompatible_top_two`, receive no numeric AIPAC component, and cannot select the AIPAC route. This prevents a method mismatch from silently changing rankings.

The 15 UDP challenger relationships remain labeled medium-confidence inferred candidate relationships in the parent foundation. Numeric use here does not upgrade them to reviewed facts. Human review and a separate promotion decision remain required before any public release.

## Reproduction and validation

Place the three locked official ZIPs (`pas222.zip`, `pas224.zip`, `pas226.zip`) in `/tmp/dsa-aipac-evidence-20260804`, or set `DSA_SEATS_AIPAC_PAS2_DIR`, then run:

```sh
npm run generate:aipac-numeric-evidence
npm run generate:dsa-target-review-v3
npm run data:verify
npm test -- --run src/ingestion/fec/aipac-numeric-evidence-candidate.test.ts src/domain/dsa-target-review-report-v3.test.ts src/domain/dsa-target-review-report-v2.test.ts
npm run typecheck
```

The candidate and report validators pin the exact parent hashes, derivation-set hashes, and package/report hashes. Tests cover the 212-seat/six-cell closure, conflict-to-unknown firewall, complete-zero semantics, revision receipts, privacy, route deltas, Washington compatibility fence, and edit-and-rehash rejection. The v2 regression test remains the publication firewall.
