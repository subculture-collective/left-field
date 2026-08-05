# AIPAC evidence foundation candidate — 2026-08-05

## Outcome

The retained automatic foundation candidate replaces the v1 queue's blanket manual-review posture with deterministic, reversible dispositions. It does not claim a human approval, publish evidence, or create a score.

- 206 exact incumbent relationships are `auto_verified_direct` after non-conflicting BioGuide, FEC candidate, House office, state, district, party, and authorized-committee checks.
- 15 unique UDP Democratic-primary target relationships remain explicitly `auto_inferred_candidate` with medium confidence. They are not relabeled as direct facts.
- Eight conflicting relationships remain `needs_review_conflict`, are excluded from evaluator use, and form the complete remaining human decision queue.
- The two-pass OpenFEC acquisition closure is retained as an `auto_verified_derived_candidate`: 84 AIPAC PAC filings, 270 UDP filings, and 1,145 sanitized UDP Schedule E records through the 2026-08-04 cutoff, with terminal empty-page evidence.
- UDP's AIPAC-network classification is retained as an `auto_verified_direct_candidate` because the exact package includes an explicit AIPAC primary statement and separate FEC committee identities. The committee IDs alone are not treated as proof of the editorial relationship.

This is a candidate foundation for the next numeric evidence build. `reviewerOnly` is true, `publicationEligible` is false, numeric AIPAC evidence rows are zero, and evaluator route selections are zero.

## Exact artifact

- File: `data/metadata/aipac-evidence-foundation-candidate-v1.json`
- File size: 338,166 bytes
- File SHA-256: `a0fe151080a0958c6cdddc447d50db4044700e31960d37dd2326ea86d6f7a7b7`
- Package SHA-256: `cb888028e9038a69d5000d80f3bb330085200335597c101362584183b8be49da`
- Parent packages: candidate/seat mappings v1, evidence closure v1, and AIPAC-network classification v1

Every relationship and remaining decision has its own domain-separated SHA-256. The package validator recomputes those hashes and the package hash, requires the three exact parent package hashes, and compares the complete relationship and decision universes to fixed domain-separated set hashes. The generator—not a caller assertion—hashes the exact parent files before building. A fully rehashed altered parent or child therefore fails validation. Exact counts, uniqueness, acquisition closure, and the nonpublication contract are also enforced.

## Remaining queue

The eight remaining rows are the six incumbent candidate/principal-committee conflicts and the two relationships that associate `H0IL07167` with different seats. Their safe default is to exclude only the affected relationship. They do not block any of the 221 usable candidate relationships or the next evidence-calculation work.

## Reproduction

```bash
npm run generate:aipac-evidence-foundation
npm run test:run -- src/ingestion/fec/aipac-evidence-foundation-candidate.test.ts
npm run data:verify
```
