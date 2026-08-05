# AIPAC incumbent conflict resolution candidate — 2026-08-05

## Outcome

The six generic incumbent candidate/principal-committee conflicts now have evidence-specific, cycle-specific proposed dispositions. None is automatically approved. Every relationship remains excluded from evaluator and publication use until an authorized reviewer accepts its resolution.

| Seat | Finding | Proposed cycle treatment |
|---|---|---|
| CA-31 | The FEC sources use an H8/H4 candidate-ID inconsistency and omit the 2024 CCL relationship. | Keep `H8CA39174` canonical; record `H4CA31170` as a Form-2 alternate; propose `C00850420` for 2024 only through the explicit direct-form override and for 2026 through the exact CN/CCL match. |
| MA-06 | The historical House committee became a Senate committee. | Propose `H4MA06090` → `C00547240` for 2022/2024; exclude 2026 as `office_changed_to_senate`, not zero finance. |
| MD-04 | The frozen identity input supplied a stale/non-native FEC candidate ID. | Propose canonical `H2MD04232` → `C00792283` for 2026 while retaining `H2MD04315` as the source alias. |
| MN-03 | Candidate and committee match, but the official FEC party code is `DFL`, not literal `DEM`. | Preserve raw `DFL`; propose `H4MN03118` → `C00856062` for 2024/2026 only under an explicit reviewable DFL-to-Democratic affiliation alias. |
| NH-01 | The historical House committee became a Senate committee. | Propose `H8NH01210` → `C00660464` for 2022/2024; exclude 2026 as `office_changed_to_senate`, not zero finance. |
| NY-04 | The frozen identity input supplied a stale FEC candidate ID, and committee relationships are cycle-specific. | Propose canonical `H2NY04244` → `C00840165` for 2026 while retaining `H4NY04158` as the source alias; do not backfill the 2026 committee into earlier cycles. |

## Evidence and privacy boundary

The retained authority receipt allowlists only candidate, office, district, party, committee, filing, and provenance facts. It points back to the nine exact FEC bulk archives already hashed in the frozen mapping proposal. Thirteen official Form 1/Form 2 PDFs and the official Minnesota DFL affiliation page are byte-identified in the source lock by URL, byte size, and SHA-256 but deliberately nonretained. This avoids adding address-bearing nationwide bulk files, filing PDFs, or a transient web-page copy to the repository while preserving repeatable byte identity.

The decisive official filing sources predate the evidence cutoff. The authority receipt was observed on August 5 and does not pretend that its later retrieval was an input to the August 4 numeric closure. It is an additive reviewer evidence receipt only.

Important official source examples include the FEC candidate and committee records for [Glenn Ivey](https://www.fec.gov/data/candidate/H2MD04232/) / [C00792283](https://www.fec.gov/data/committee/C00792283/), [Kelly Morrison](https://www.fec.gov/data/candidate/H4MN03118/) / [C00856062](https://www.fec.gov/data/committee/C00856062/), and [Laura Gillen](https://www.fec.gov/data/candidate/H2NY04244/) / [C00840165](https://www.fec.gov/data/committee/C00840165/). The Minnesota DFL affiliation rule remains visible as a reviewer policy choice rather than rewriting the raw FEC party code.

## Fail-closed contract

The generator requires the exact frozen mapping-proposal and authority-receipt file hashes. It reconstructs the six-row conflict universe, verifies every source decision/candidate/seat tuple, requires each official filing to be a nonretained source-lock entry at an FEC PDF URL, enforces empty House committees for a 2026 Senate transition, preserves the explicit DFL alias state, and domain-hashes every resolution and the package.

The candidate's default is `excluded_pending_authorized_review`. It records six pending mapping decisions, zero automatic approvals, and the four independent methodology/promotion decisions. It does not mutate the v1 foundation, numeric evidence candidate, v3 report, or public release.

## Reproduction

```bash
npm run generate:aipac-incumbent-conflict-resolution
npm run test:run -- src/ingestion/fec/aipac-incumbent-conflict-resolution-candidate.test.ts
npm run typecheck
npm run data:verify
```

Generated artifacts:

- `data/metadata/aipac-incumbent-fec-authority-receipt-v1.json`
- `data/metadata/aipac-incumbent-conflict-resolution-candidate-v1.json`

An authorized review record is still required before a later foundation or numeric candidate may consume any proposed House relationship. A source-locked proposal is evidence for a decision; it is not the decision itself.
