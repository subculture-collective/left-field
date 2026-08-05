# AIPAC incumbent resolution dispositions v2 — 2026-08-05

## Outcome

The six incumbent cases previously blocked as a unit are now resolved at the cycle level under the repository policy that mechanically verifiable direct and explicitly labeled derived relationships should continue without a fabricated human approval. Five cases are fully resolved; CA-31 is partially resolved. Exactly one relationship remains excluded: CA-31 in 2024.

This is a reviewer-only additive candidate. It does not rewrite the frozen August 4 numeric closure, approve a methodology, promote a data release, or alter the public application. The downstream numeric v2 candidate and report v4 remain immutable and continue to show all six seats as blocked until a distinct numeric successor is generated from foundation v3.

| Seat | Automatic disposition | Remaining exclusion |
|---|---|---|
| CA-31 | Use the exact 2026 `H8CA39174` → `C00850420` relationship in a later reviewer-only numeric build. | Keep 2024 excluded. CN24 names stale `C00650648`, CCL24 has no relationship, and the direct Form 2 override lacks a cutoff-bounded terminal amendment-chain receipt. |
| MA-06 | Retain exact 2022/2024 House relationship `H4MA06090` → `C00547240`; classify 2026 as `office_changed_to_senate`. | None. The 2026 House cycle is not applicable, never zero. |
| MD-04 | Correct the native FEC identity to `H2MD04232` → `C00792283` for 2026 and retain `H2MD04315` as a source alias. | None. No earlier cycle is inferred. |
| MN-03 | Retain exact 2024/2026 `H4MN03118` → `C00856062`; preserve raw FEC party `DFL` and label the source-backed Democratic affiliation as derived. | None. This does not rewrite the raw party code to `DEM`. |
| NH-01 | Retain exact 2022/2024 House relationship `H8NH01210` → `C00660464`; classify 2026 as `office_changed_to_senate`. | None. The 2026 House cycle is not applicable, never zero. |
| NY-04 | Correct the native FEC identity to `H2NY04244` → `C00840165` for 2026 and retain `H4NY04158` as a source alias. | None. The committee is not backfilled into earlier cycles. |

## Remaining decision

Stable ID: `aipac-mapping-precedence:incumbent:seat_house_ca_31_current:2024:H8CA39174`

Question: Should the 2024 CA-31 relationship use `C00850420` when CN24 names stale committee `C00650648`, CCL24 supplies no link, and the retained direct Form 2 evidence has no cutoff-bounded terminal-amendment-chain receipt?

Recommendation: defer only this cycle until a source-locked terminal amendment chain proves which filing controlled at the cutoff. The reversible default excludes CA-31/2024 while retaining its independently exact 2026 relationship. This blocks publication only for the affected relationship and does not block any other work.

Required evidence: `cutoff_bounded_terminal_form2_amendment_chain_receipt`.

No reviewer, resolution, signature, timestamp, or approval is claimed.

## Integrity and privacy

The v2 disposition artifact binds the exact file and package hashes of the immutable six-case proposal. Each case, the remaining decision, both derived sets, and the whole package are domain-hashed. Official filing evidence remains represented by the already locked privacy-minimized filing IDs, URLs, byte sizes, and hashes; donor names, addresses, employers, occupations, and filing free text are not copied into the artifact.

Foundation v3 wraps the original 229 relationships without rewriting their source identities. For MD-04 and NY-04 it retains the stale source IDs inside the original relationship and records the corrected native FEC ID only in the additive resolution. For CA-31 it admits only the eligible 2026 cycle and carries the 2024 exclusion as the sole remaining decision.

## Reproduction

```bash
npm run generate:aipac-incumbent-resolution-v2
npm run generate:aipac-evidence-foundation-v3
npm run test:run -- \
  src/ingestion/fec/aipac-incumbent-resolution-dispositions-v2.test.ts \
  src/ingestion/fec/aipac-evidence-foundation-candidate-v3.test.ts
npm run typecheck
npm run data:verify
```

Artifacts:

- `data/metadata/aipac-incumbent-resolution-dispositions-v2.json`
  - artifact SHA-256: `c4babb56fe21a99cde0dd9a5a9922f3510899cd507709f9d72afe892f05686fe`
  - package SHA-256: `81f0d5996356ccae3747104009eaf5fdb4a96a2c8bf5a2c8da838eadcd924a7a`
  - remaining-decision-set SHA-256: `6616e4915e544835d6f3a4121bd130a32432d520df9cb40e3b846df684a8581e`
- `data/metadata/aipac-evidence-foundation-candidate-v3.json`
  - artifact SHA-256: `25dd9e55584e81586413d0d818c3ff6567c1cbdfeb093e1720bb6a36ae97b8dc`
  - package SHA-256: `812a0cf887dff3b268e0fdcc6800eab446e9bd20926508232f1a4c2b4b41ba0f`

The next downstream slice is a distinct numeric candidate generated from foundation v3. It must preserve CA-31/2024 as blocked, treat MA-06/NH-01 2026 as not applicable rather than zero, and remain reviewer-only until methodology and publication decisions are separately resolved.
