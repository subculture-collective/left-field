# Illinois primary identity-geography review package v2

Date: 2026-08-06
Status: proposed reviewer package; unapproved, score-ineligible, publication-ineligible

## Outcome

Joint review v2 composes the immutable 34-record Illinois identity/geography queue with the State Board certification-authority receipt. It preserves every v1 record digest, identity payload, geography payload, contest coordinate, progressive-classification exclusion, and evaluator exclusion. The only evidence projection changed is certification:

- v1: `not_retained`;
- v2: `election_level_authority_candidate`, with approval still false.

All 34 records now carry exact authority-receipt and authority-scope row hashes. The review matrix remains 28 records with identity and geography candidates plus six geography candidates outside the current-target identity scope (districts 12, 15, and 16 in both cycles).

## Decision transition

The v1 decision that recommended retaining exclusion while acquiring final authority is obsolete as an acquisition instruction, because exact State Board instruments are now retained. V2 replaces only that decision with `il-primary:accept-election-level-certification-authority-v2`.

Recommended decision: accept election-level State Board certification authority for all 34 records without claiming individual contest certificates or candidate-by-name certification.

Safe reversible default: keep all affected records excluded from evaluator and publication use until review. Accepting the authority resolves only the certification-authority component. It cannot approve a contest record, identity relationship, geography relationship, progressive classification, score, publication, or deployment.

The geography, identity, and progressive-classification decisions remain the exact v1 proposals with null resolutions. All four decisions remain independent and proposed.

## Preserved limits

- The 2022 State Board index date of August 5 and instrument/certification date of July 29 remain distinct on every 2022 record.
- No individual district certificate is claimed.
- No candidate is certified by name, selected as winner, or inferred to be a nominee.
- The six out-of-scope identity records remain null; no identity is fabricated.
- Parent record fields are not mutated by composition.
- Certification authority acceptance does not automatically approve records.
- All 34 records remain jointly unapproved, score-ineligible, evaluator-excluded, unpublished, and undeployed.

## Artifact and reproduction

| Field | Value |
|---|---|
| Artifact | `data/metadata/illinois-primary-identity-geography-review-package-v2.json` |
| Bytes | 117,750 |
| SHA-256 | `69579eb1f8d1b63e0733bf65745bb13e6726ecbc82c832f2bae11e693e8e53aa` |
| Package SHA-256 | `7657f4dfe5bcc4e91718f65803eb2a04bbe25fb4f062ad4015ba2cec8fc6a3c0` |
| Record-set SHA-256 | `d10ddc5717dc2a3056e836c01f47ef0d31d7cecd6bcf2b8a85a64987c840f19f` |
| Decision-set SHA-256 | `40f19624eddce4d559be2f33f726a41f03c72aa99e9e598b8f9f8f6fe6ba6693` |

```bash
npm run generate:il-primary-joint-review-v2
npx vitest run src/ingestion/elections/illinois-primary-identity-geography-review-package-v2.test.ts --maxWorkers=1
npm run data:verify
```
