# AIPAC challenger ambiguity resolution candidate — 2026-08-05

## Outcome

The retained reviewer-only receipt mechanically closes the two-row `H0IL07167` candidate-to-seat ambiguity without rewriting the immutable foundation or numeric candidates.

- Illinois 7 is the unique jurisdiction with positive 2024 Democratic-primary opposition source rows for `H0IL07167`: 20 positive records and one negative adjustment.
- California 47 has one negative adjustment and no positive source record for that candidate ID. A negative or zero adjustment cannot originate a new candidate-seat relationship, so this relationship is automatically rejected as an invalid origin.
- Both old conflict rows remain preserved in the v1 foundation as historical provenance. This additive receipt is the required parent for a future reviewer-only foundation/numeric version.
- Six incumbent candidate/principal-committee conflicts remain unresolved. The three methodology choices and the separate promotion decision also remain open.

The artifact is not a human review, a public fact, or a release transition. It sets `reviewerOnly: true`, `publicationEligible: false`, and `defaultUse: apply_to_next_reviewer_only_foundation_exclude_from_publication`. The current numeric candidate, v3 reviewer report, published v2 release, and public application are unchanged.

## Exact artifact

- File: `data/metadata/aipac-challenger-ambiguity-resolution-candidate-v1.json`
- File size: 4,268 bytes
- File SHA-256: `65d037d3ad8488f1086603fd22c33288f92a235c1ba0fcb969b7349542f8d0b7`
- Package SHA-256: `46ef7ba344f2ec975b3e1eebdf83f569d7d36f619486ed10e7868dbe4ca08624`
- Parent files: exact retained evidence-closure proposal and evidence-foundation candidate v1

The generator pins both parent file hashes, requires the exact two foundation conflicts, reselects only 2024 House Democratic primary-opposition records for `H0IL07167`, rejects every relevant row outside the two explicitly accounted jurisdictions, and fails unless Illinois 7 is the sole jurisdiction with any positive row. It hashes every selected sanitized source-record identity into the two dispositions. It neither collects names nor restores any private or free-text field. Generation is exclusive-create and idempotent: identical existing bytes are accepted, while differing bytes at the versioned output path fail with `AIPAC_AMBIGUITY_OUTPUT_CONFLICT`.

## Reproduction

```bash
npm run generate:aipac-challenger-ambiguity-resolution
npm run test:run -- src/ingestion/fec/aipac-challenger-ambiguity-resolution-candidate.test.ts
npm run data:verify
```
