# Connecticut final primary ballot receipt v1

Status: **proposed reviewer-only evidence receipt**. It is not approved, published, evaluator-eligible, or deployed.

## Outcome

This receipt retains the complete official Connecticut Secretary of the State posted Democratic primary-ballot corpus exposed by the statewide 2022 and 2024 town indexes:

| Cycle | Official town rows | Linked Democratic ballots | Rows with no Democratic ballot link | Linked ballots with a U.S. House office contest |
| --- | ---: | ---: | ---: | ---: |
| 2022 | 169 | 168 | 1 (`Lisbon`) | 0 |
| 2024 | 169 | 28 | 141 | 0 |
| Total | 338 | 196 | 142 | 0 |

All 196 linked documents are retained as their exact official PDF bytes and individually source-locked. All are distinct by SHA-256 and have valid PDF signatures. The corpus is approximately 20.7 MB. `pdftotext -layout` produced reviewable text for 193 documents. The image-only Chaplin, Lebanon, and Stamford 2024 ballots were reviewed with OCR plus visual inspection. No reviewed ballot contains a U.S. House office row or personal-address field.

The one raw text occurrence of `Congressional District 1` is the jurisdiction header on Bloomfield's 2022 ballot. It is not an office contest.

## Exact evidence boundary

The receipt makes two direct observations and keeps them separate:

1. A linked official Democratic ballot was reviewed and no U.S. House office contest was observed on that ballot.
2. The official statewide town index contains no Democratic ballot link for that town.

Neither observation establishes why a House contest or ballot is absent. In particular, the receipt does **not** infer:

- zero votes or an uncontested result;
- no candidate or no valid challenge;
- withdrawal, death, disqualification, or cancellation;
- party endorsement becoming nomination;
- a nominee, winner, or certified result;
- any statutory conclusion under Connecticut Chapter 153;
- evaluator values, score eligibility, approval, publication, or deployment.

The official 2024 page labels its documents “Primary Sample Ballots,” while the retained PDFs themselves use “Official Ballot.” This package therefore calls the evidence the **official posted ballot corpus** and does not make a broader legal-finality claim.

## Provenance and integrity

- Official 2022 index: `ct-2022-primary-town-ballot-index`
  - 110,380 bytes
  - SHA-256 `9148bb2d6b8f5b8dd8d4059101de257a886b8c61b7a6669b592ed5af163139dd`
- Official 2024 index: `ct-2024-primary-sample-ballot-index`
  - 113,195 bytes
  - SHA-256 `69ef4ef5ab5b9e2bd3bcf5113442c8b745251783811349908932ec4ac30f3470`
- Immutable 198-source catalog: `ct-final-primary-ballot-source-catalog-v1`
  - 212,039 bytes
  - SHA-256 `746dba8bf3f7f4e47e776a47d63f876be496f6faa0e7101e31b0a68a5da410ca`
  - parents: two official indexes plus all 196 official ballot PDFs
- Receipt: `connecticut-final-primary-ballot-receipt-v1`
  - 350,414 bytes
  - SHA-256 `89534d72aec69f72cb71b134390d0a30c281125b75b65a2c83f79b2e2c7ab26f`
  - package SHA-256 `3966fec0dd071fb8b823679002601e790c459d466a37f70e032917ae5d86e21c`
  - document-set SHA-256 `9c0ad5c9d73c083aed971a8431b96be4e846e197bda8efaad8d31f9683004190`
  - town-row-set SHA-256 `5de917eb8d03a9b06419776dcf36e7b7ff4a56fb69eab122ff9114f38607e362`

The acquisition command verifies every source's pinned URL, byte size, and SHA-256 before an exclusive write. Existing paths are accepted only when their bytes are identical. The source catalog requires exactly 169 unique town labels per cycle, 196 unique document IDs/URLs/paths, and the exact 168/28 link counts.

## Validation

Focused validation:

```text
TMPDIR=/tmp npm run test:run -- scripts/fetch-connecticut-final-primary-ballots.test.ts src/ingestion/elections/connecticut-final-primary-ballot-receipt.test.ts
npm run typecheck
npm run generate:ct-final-primary-ballot-receipt
npm run audit:ct-final-primary-ballots
node scripts/verify-source-lock.mjs
git diff --check
```

The adversarial tests reject source substitution, hash/path/parent drift, catalog truncation, no-primary or nomination escalation, fabricated approval, publication or scoring escalation, unknown fields, and coherently rehashed semantic changes.

## Next gate

This v1 receipt deliberately does not alter `connecticut-primary-evidence-review-package-v2`. A later v3 evidence package may join this receipt to the endorsement, event-disposition, statutory, identity/geography, and general-election evidence only after independent corpus review. Applying the statutes and assigning a nomination mechanism remains a human legal-review decision.
