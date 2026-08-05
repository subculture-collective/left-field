# New York House Democratic primary reported-result corpus — 2026-08-05

## Status

This reviewer-only candidate retains every Democratic U.S. House primary contest observed in the New York State Board of Elections result system and its linked official result compilations for August 23, 2022, and June 25, 2024. It is not a complete 26-district disposition matrix, a signed certification package, or a score-bearing primary-history release.

The machine-readable result endpoint is an undocumented public crosstab interface backing the official result pages. Because no documented whole-election API was verified, the package limits its claim to the reported contests enumerated by the official result documents: nine in 2022 and two in 2024.

## Exact corpus and reconciliation

- Two official result compilation PDFs, one for each cycle.
- Eleven exact contest CSVs: nine from 2022 and two from 2024.
- Thirty candidate columns and 54 county rows.
- Candidate votes: 399,145.
- Scattering, blank, and void votes: 4,547.
- Total votes: 403,692.
- Every county and district row reconciles horizontally to its supplied total.
- Every county column reconciles vertically to the congressional-district row.
- Contest-set SHA-256: `f0b4ebcae9dee7cb689503dc9a4532d140e963c3df2dcc9ebbdd1cef358447d6`.
- Package SHA-256: `5ba3280bd2a837281877a0fb70979b42501afd6e7e9d8567149e1b22942e125b`.
- File SHA-256: `e9ba0cfb9961d4dc71123bba78ab949b8090eceb7684b8fbf87caca196b712f2`.

## Completeness boundary

New York had 26 congressional districts in each retained cycle, but the official reported-result corpus contains only nine Democratic House contests for 2022 and two for 2024. In this result-only receipt, the remaining 17 and 24 districts are `unclassified`, not zero and not automatically uncontested. The separate ballot-disposition candidate now resolves 4 of those 2022 absences and 11 of those 2024 absences as explicitly certified `Uncontested`; district 01 and districts 04 through 15 remain unresolved in both cycles because they fall outside the state certification's scope.

Research indicates that the June 28, 2022 primary did not include U.S. House contests and that congressional primaries occurred August 23. That conclusion is recorded only as `researched_not_source_locked_do_not_use` until adequate statewide authority is retained. The August source also overlaps special-election activity, so the package binds only result-system contests explicitly identified as Democratic primaries for Representative in Congress.

The platform describes its records as published after certification, but the individual CSVs do not carry a signed certificate, certification timestamp, or independent certification receipt. This package therefore says `certificationStatus: not_independently_retained`. No explicit permissive dataset license was identified; the source is retained as official public election-result evidence without claiming public-domain or open-license status.

Five gates remain before scoring or publication:

1. complete the 26-district state contest/disposition universe for both cycles;
2. retain independent final-certification evidence;
3. review candidate-to-current-incumbent identity;
4. review historical-district compatibility with the current target geography;
5. retain a separate contest-effective progressive-candidate classification.

Every evaluator value is null, every contest is score-ineligible, and the package is publication-ineligible.

## Reproduction

```bash
npm run fetch:ny-house-primary-reported-results
npm run generate:ny-house-primary-reported-results
npx vitest run src/ingestion/elections/new-york-house-democratic-primary-reported-results-receipt.test.ts
npm run typecheck
npm run data:verify
```
