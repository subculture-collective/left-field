# Connecticut primary evidence review package v3 — 2026-08-06

Status: **proposed reviewer queue**. It is not approved, evaluator-eligible, score-bearing, published, or deployed.

## Outcome

V3 joins exactly two immutable parents:

1. `connecticut-primary-evidence-review-package-v2`
2. `connecticut-final-primary-ballot-receipt-v1`

It preserves v2's ten U.S. House district-cycle review rows and attaches the new ballot receipt only as **cycle-level statewide evidence context**. No town, ballot PDF, or blank index cell is assigned to a congressional district. No town-to-district crosswalk was performed, and v3 makes zero district-specific ballot-completeness claims.

| Evidence measure | Count |
| --- | ---: |
| District-cycle review records | 10 |
| Cycles | 2 |
| Official ballot-index town rows | 338 |
| Linked Democratic ballots reviewed | 196 |
| Index rows with no Democratic ballot link | 142 |
| Linked ballots with a U.S. House office contest | 0 |
| District-specific ballot joins | 0 |
| Primary-nomination conclusions | 0 |
| Result conclusions | 0 |
| Approved / score-eligible rows | 0 / 0 |

For 2022, each record references the cycle aggregate of 169 index rows, 168 linked ballots, one no-link row, and zero observed House office contests. For 2024, the aggregate is 169, 28, 141, and zero. These are repeated evidence references, not duplicated facts or district assignments.

## Legal and factual boundary

V3 does not combine ballot absence with v2's statutory timing or general-election observations. “No U.S. House office row on the linked posted ballots” and “no Democratic ballot link on the official index” do not establish:

- no primary, candidate, or valid challenge;
- an uncontested nomination;
- withdrawal, death, disqualification, or cancellation;
- a statutory trigger under §§ 9-400, 9-415, 9-416, 9-426, or 9-429;
- a nominee, winner, result, or certification;
- district-level exhaustiveness or the legal finality of the posted corpus.

Every record retains null ballot, statutory-nomination, primary-nomination, and result conclusions; `approved: false`; `scoreEligible: false`; and evaluator exclusion.

## Proposed decisions

Three independent proposed decisions are scoped to all ten records. Each has a null reviewer, timestamp, and resolution, blocks affected publication, and does not block unrelated work.

1. `ct-primary-v3:accept-posted-ballot-corpus-scope-v1`
   - Recommended: accept the two indexes and 196 ballots as the complete posted corpus represented by those indexes, usable only as cycle-level context.
   - Safe default: keep it excluded from the evaluator until reviewed.
2. `ct-primary-v3:retain-primary-disposition-exclusion-v1`
   - Recommended: keep zero House rows and blank index cells non-dispositive.
   - Safe default: infer no primary disposition.
3. `ct-primary-v3:retain-statutory-nomination-exclusion-v1`
   - Recommended: defer statutory application until direct trigger facts and human legal review exist.
   - Safe default: do not apply the statute or name a nominee.

## Integrity

- Artifact: 26,472 bytes
- File SHA-256: `9ac5a19b42ce7e5fabfb0f307a28b52486f54c349f9d348aa0d9712e3b58f5ca`
- Package SHA-256: `3b1b56f41552005223396ff0bcd46704853fc383350d98b0b6eb039404dc349c`
- Review-record set SHA-256: `9404bf96bdec976cfb83c9af9c9f435595619b96282abcf6e9e971ea21fa9301`
- Decision-set SHA-256: `d258b618aa07dee7ced9319763b3db57730215c7aeafec08609aeaea6d4dfcf4`

The source lock gives v3 exactly the two direct parents above. Parent byte hashes, package validators, source-lock metadata, output lineage, cycle aggregates, record inheritance, decision order/scope/lifecycle, and the null/nonpublication contract are fail-closed.

```text
npm run generate:ct-primary-evidence-review-v3
TMPDIR=/tmp npm run test:run -- src/ingestion/elections/connecticut-primary-evidence-review-package-v3.test.ts
npm run typecheck
npm run data:verify
git diff --check
```

## Remaining gates

- independent user review of the posted-corpus integrity and limited scope;
- determine whether the posted corpus satisfies the final-candidacy-universe requirement;
- direct statutory-trigger evidence and human legal review;
- independent identity/geography/general-election review;
- final publication approval.
