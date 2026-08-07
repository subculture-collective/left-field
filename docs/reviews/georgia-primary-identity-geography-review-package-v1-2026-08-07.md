# Georgia primary identity/geography review package v1

## Outcome

This immutable reviewer queue joins all 12 Georgia current-incumbent identity observations to their exact geography rows:

| Review category | Count |
|---|---:|
| `identity_and_geography_candidates` | 5 |
| `identity_candidate_crosswalk_review` | 2 |
| `identity_candidate_no_same_block_geography` | 1 |
| `identity_candidate_cd120_geography_pending` | 4 |

The five joint candidates are 2022 GA-02 plus all four 2024 records. The 2022 GA-04 and GA-05 rows retain split-crosswalk review. Lucy McBath's 2022 source GA-07/current GA-06 row retains zero shared target blocks and no geography candidate; the valid person-identity proposal does not become a geographic relationship. All four 2026 rows retain session 120, null historical GEOIDs, and pending CD120 authority.

Identity evidence remains exactly seven normalized-name observations and five documented derived relationships. The package does not flatten Bishop's middle/suffix omissions or Johnson's 2024/2026 middle-initial omissions into exact matches. All 12 result rows preserve the Secretary official-workbook boundary, no separately retained signed certificate, source winner unmarked, and null winner/nomination/runoff conclusions.

## Decisions and lifecycle

Five independent proposed decisions cover all 12 ordered records: official-result authority, identity links, geography compatibility, primary-disposition exclusion, and progressive-classification exclusion. Every review has null reviewer, timestamp, and resolution. The reversible default excludes affected records from the evaluator and publication without blocking other work.

All identity, geography, and joint approvals remain false. Zero rows are score-eligible, published, or deployed. The join cannot approve either parent package.

## Integrity closure

- Artifact bytes: 42,170
- File SHA-256: `988b3fd039e74fa80a212460695c189419a8590ecd27c969192acff97565eddf`
- Package SHA-256: `51e6177b4ffcb80a367590a5591ead57f5e1802e52543b824740057f6281c9f5`
- Review-record-set SHA-256: `5088a746de732a2e39fd981bce5afa5c963c9d927f08a1569417a3ad5056b93a`
- Decision-set SHA-256: `4d79b4edf91538e21e6e7444996e7dc573f4d4fc981c9b44ca47d14623621f90`

The source-lock topology contains exactly three ordered direct parents: the source-selection proposal, Georgia identity candidate, and Georgia geography candidate. Receipt, Census, TIGER, and block-crosswalk provenance remains bound transitively rather than duplicated.

## Reproduction

```bash
npm run generate:ga-primary-joint-review-v1
npx vitest run src/ingestion/elections/georgia-primary-identity-geography-review-package.test.ts
npm run typecheck
npm run data:verify
```
