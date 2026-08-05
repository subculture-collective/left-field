# AIPAC reviewer decision queue — 2026-08-04

Status: **proposed, reviewer-only, and nonpublishable**

The deterministic queue is `data/metadata/aipac-review-decision-queue-v1.json`. It is bound to the exact mapping, evidence-closure, and network-classification proposal hashes. Its default for every unresolved decision is `exclude_from_scoring_and_publication`. It does not name a reviewer, record an approval, or authorize a release.

This v1 queue is retained as historical input. The later automatic foundation candidate applies the repository policy that deterministically verifiable relationships should continue without manual approval and carries the current actionable queue of only eight genuine conflicts. It does not rewrite this artifact or fabricate review resolutions; see [`aipac-evidence-foundation-candidate-2026-08-05.md`](aipac-evidence-foundation-candidate-2026-08-05.md).

## Review package

- 231 total decisions: 229 candidate/seat relationships, one evidence-closure decision, and one United Democracy Project network-classification decision.
- 212 direct incumbent mappings and 17 inferred Democratic-primary challenger mappings.
- 221 mapping proposals have non-conflicting source relationships. Six incumbent mappings contain a principal-committee crosscheck conflict, and two inferred rows share one FEC candidate ID across two seats; all eight rows need individual review.
- Source cutoff: `2026-08-04`. This queue is not compatible with the separately fixed FEC v2 production cutoff of `2026-07-18` and must not be relabeled or imported into that release.
- Queue package SHA-256: `29e5a067ed00904da1d2ccf23f61e702a3616bd4384dd8fd7ac1f2f54e032e4d`.

## Decisions needing individual review

| Decision | Candidate | Seat | Recommended decision | Safe default | Consequence if accepted |
| --- | --- | --- | --- | --- | --- |
| `mapping:incumbent:seat_house_ca_31_current:H8CA39174` | `H8CA39174` | `seat_house_ca_31_current` | Resolve the candidate/principal-committee conflict, then accept only the corrected exact mapping. | Exclude | Permits the reviewed relationship to enter a later evidence build. |
| `mapping:incumbent:seat_house_ma_06_current:H4MA06090` | `H4MA06090` | `seat_house_ma_06_current` | Resolve the candidate/principal-committee conflict, then accept only the corrected exact mapping. | Exclude | Permits the reviewed relationship to enter a later evidence build. |
| `mapping:incumbent:seat_house_md_04_current:H2MD04315` | `H2MD04315` | `seat_house_md_04_current` | Resolve the candidate/principal-committee conflict, then accept only the corrected exact mapping. | Exclude | Permits the reviewed relationship to enter a later evidence build. |
| `mapping:incumbent:seat_house_mn_03_current:H4MN03118` | `H4MN03118` | `seat_house_mn_03_current` | Resolve the candidate/principal-committee conflict, then accept only the corrected exact mapping. | Exclude | Permits the reviewed relationship to enter a later evidence build. |
| `mapping:incumbent:seat_house_nh_01_current:H8NH01210` | `H8NH01210` | `seat_house_nh_01_current` | Resolve the candidate/principal-committee conflict, then accept only the corrected exact mapping. | Exclude | Permits the reviewed relationship to enter a later evidence build. |
| `mapping:incumbent:seat_house_ny_04_current:H4NY04158` | `H4NY04158` | `seat_house_ny_04_current` | Resolve the candidate/principal-committee conflict, then accept only the corrected exact mapping. | Exclude | Permits the reviewed relationship to enter a later evidence build. |
| `mapping:challenger:seat_house_ca_47_current:H0IL07167` | `H0IL07167` | `seat_house_ca_47_current` | Resolve the candidate-to-seat ambiguity; do not accept the same FEC candidate ID for two seats. | Exclude | Permits only a corrected, unique relationship to enter a later evidence build. |
| `mapping:challenger:seat_house_il_07_current:H0IL07167` | `H0IL07167` | `seat_house_il_07_current` | Resolve the candidate-to-seat ambiguity; do not accept the same FEC candidate ID for two seats. | Exclude | Permits only a corrected, unique relationship to enter a later evidence build. |

These eight rows represent seven review questions. They do not block package validation, source research, report tooling, sensitivity tests, or other office/data work. They block use of the affected relationships in a reviewed score and block any publication claim for those relationships.

## Batch recommendations awaiting review

- The 206 non-conflicting direct incumbent mappings are recommended for batch acceptance after the reviewer verifies the package hashes and exact Bioguide/FEC/district/party/authorized-committee rationale.
- Fifteen non-conflicting challenger relationships are inferred from exact UDP Schedule E Democratic House primary targets and can be reviewed as a separate batch. Keep the two `H0IL07167` rows isolated until the candidate-to-seat ambiguity is corrected; do not merge any inference state into direct incumbent mappings.
- Review the evidence closure independently by replaying the two terminal passes and amendment/file-number logic.
- Review UDP's AIPAC-network classification independently from FEC committee identity. A committee ID proves the filer, not the editorial relationship by itself.

Changing any input package changes the queue hash and requires regeneration with `npm run generate:aipac-decision-queue`. Proposed decisions must remain unable to affect the public score, a release transition, or publication proof.
