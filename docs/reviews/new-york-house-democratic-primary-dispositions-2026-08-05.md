# New York House Democratic primary disposition candidate

## Reviewer boundary

This reviewer-only candidate combines two signed New York State Board of Elections ballot certifications with the separately retained reported-result corpus. It creates an explicit 52-row matrix for the 26 congressional districts in 2022 and 2024, but resolves only the districts directly covered by state authority. It publishes nothing, assigns no score, and creates no zero-vote result.

The state ballot certifications cover congressional districts 02, 03, and 16 through 26 because those districts cross county boundaries. They explicitly label one-candidate Democratic entries `Uncontested`. District 01 and districts 04 through 15 are absent from both state certifications; they remain `unresolved_outside_state_certification_scope`, not no-primary, uncontested, or zero.

## Exact retained result

- Seat-cycle rows: **52**
- Resolved from retained authority: **26** (13 per cycle)
- Reported contests inherited from the result receipt: **11** (9 in 2022, 2 in 2024)
- Explicit certified-uncontested entries: **15** (4 in 2022, 11 in 2024)
- Unresolved district-years: **26** (13 per cycle)
- Vote values, evaluator numeric values, and score-eligible rows: **0**
- Disposition-set SHA-256: `2493dd4ceab7616be7dc544c3c4f6e3e8abc121c4dcefde9b54ac958d209f69e`
- Package SHA-256: `3c3b88e1d235ef89f8022456e16e2259294cfb62de3c0778a497c3fcc51d8a78`

The 2022 certification is the signed June 29, 2022, 51-page document at `ny-2022-house-primary-ballot-certification`; the 2024 certification is the signed May 1, 2024, 194-page document at `ny-2024-house-primary-ballot-certification`. Exact page numbers are bound to every resolved row. Candidate addresses in the source PDFs are deliberately not copied into the receipt.

## Remaining gates

1. Retain authoritative county-board ballot/result evidence for district 01 and districts 04 through 15 in both cycles.
2. Retain independent final-result certification for contested results.
3. Review current-incumbent identity, historical geography, and progressive candidate classification.
4. Obtain human data review and explicit publication approval before any evaluator integration.

Until those gates close, this artifact is an auditable disposition candidate only.

## Later local-authority integration

The separately retained NYC certified-result receipt adds direct local result authority for eight rows that this immutable v1 matrix leaves unresolved: 2022 districts 07, 08, 10, 11, 12, and 13, plus 2024 districts 10 and 14. It does not retroactively change this artifact. The separately versioned v2 composition now validates those exact row replacements and derives 19 reported, 15 explicitly certified-uncontested, and 18 unresolved district-years while preserving this v1 package unchanged.
