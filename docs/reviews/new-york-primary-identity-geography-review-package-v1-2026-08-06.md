# New York primary identity/geography joint reviewer package v1

## Outcome

This reviewer-only proposal joins all 38 New York identity observations one-to-one with their geography rows without approving either parent. The records retain five materially different review categories:

| Category | Records | Meaning |
|---|---:|---|
| Identity and geography candidates | 4 | A reported current-incumbent identity candidate and exact 2024 CD119 key candidate are both present. |
| Identity candidate, geography pending | 8 | A reported 2022 identity candidate exists, but New York’s CD119 redraw requires an authoritative historical crosswalk. |
| Geography candidate, identity not applicable | 15 | An exact 2024 CD119 key exists, but the result disposition contains no reported current-incumbent candidate evidence. |
| Geography pending, identity no-match | 4 | A 2022 predecessor contest is explicitly not linked, and redraw geography remains pending. |
| Geography pending, identity not applicable | 7 | A 2022 row has no reported identity evidence and no historical crosswalk candidate. |

The joined matrix preserves 12 proposed identity links, four predecessor no-matches, 22 nonreported identity states, 19 exact 2024 geography candidates, and 19 2022 crosswalk-required geography rows. It also preserves 16 reported contests, seven certified-uncontested dispositions, 15 unresolved dispositions, nine statewide reported authorities, seven NYC certified authorities, and 22 null result-authority rows.

## Proposed decisions

Five decisions remain independent, proposed, and unsigned:

| Decision | Evidence scope | Recommended reversible treatment |
|---|---:|---|
| Geography | 38 | Accept only 19 exact 2024 CD119 session/key candidates; retain all 19 2022 rows as crosswalk-required. |
| Identity | 12 | Accept six exact and six finite derived links; preserve four predecessor no-matches and all nonreported rows. |
| Primary disposition | 38 | Preserve reported, certified-uncontested, and unresolved states without inferring winners, nominees, or zeros. |
| Progressive classification | 38 | Retain exclusion because no reviewed progressive classification is present. |
| Reported-result authority | 16 | Preserve nine statewide and seven NYC authority boundaries, including missing independent final certification for statewide results. |

Each decision’s safe default excludes its evidence records from evaluator and publication use. A decision may resolve only its named component. It cannot approve another decision, parent artifact, joint record, score, publication, or deployment.

## Lifecycle and integrity

Every package and decision review remains `proposed` with null reviewer, resolution, and timestamp. Every record remains `jointApproved: false`, with identity and geography approval false and score eligibility false. Composition establishes no source winner and supplies no evaluator numeric values.

The output is 102,113 bytes with file SHA-256 `7c626a550f1e644db1977cd39af1437384ad31e1f76602fc0f2d024cc9cc4fb8`, package SHA-256 `9abd860d67af83460ecc5e121344903c7a25e5d28691914f87a7f92ec94ed6e7`, record-set SHA-256 `f891eaaeb7dca0fdae46fe3e849a750cd46907b7d3ea5de467604f2a9a5fc19b`, and decision-set SHA-256 `981a57a584b043c2cd1856d82ed2163c3e87c9b276596f87e1f9294276558da2`.

Its exact three direct parents are the source-selection proposal, New York identity candidate, and New York geography candidate. Validation rejects parent lineage drift, join drift, set/package hash drift, and fully rehashed fabricated approval.

## Reproduction

```bash
npm run generate:ny-primary-joint-review-v1
npx vitest run src/ingestion/elections/new-york-primary-identity-geography-review-package.test.ts
npm run data:verify
```
