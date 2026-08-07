# Connecticut primary evidence review package v4

Date: 2026-08-07
Status: proposed reviewer queue; not approved, score-bearing, published, or deployed

## Result

This immutable composition preserves the ten Connecticut district-cycle evidence records in v3—districts 01–05 for 2022 and 2024—and attaches one exact official event-disposition observation to each record. The added parent is the retained Connecticut Secretary of the State historical-election event receipt.

The 2022 August primary event advertises and enumerates 17 results; the 2024 August primary event advertises and enumerates 22. Neither complete event contains a Democratic `Representative in Congress` result. The ten attached observations therefore say only `no_reported_democratic_house_primary_contest_in_complete_official_event`.

That observation is deliberately non-dispositive. It does not establish:

- that no primary occurred, no valid candidate existed, or no valid challenge was filed;
- an uncontested nomination, withdrawal, death, disqualification, or cancellation;
- a nominee, winner, advancement, vote total, zero, result, or final certification;
- district-level ballot exhaustiveness, a statutory trigger, or a statutory nomination consequence.

Every record keeps `primaryNominationStatus` and `resultStatus` null. Event vote values, nomination disposition, selected contest, disposition conclusion, and result conclusion are null. The inherited posted-ballot evidence remains cycle-level context only; no town-to-district crosswalk or district-specific ballot completeness claim is introduced.

The package preserves all three unresolved v3 decisions and adds one independent proposed decision: whether to accept the complete official event enumerations only as no-reported-contest evidence. The new decision does not supersede the existing primary-disposition exclusion. All four decisions have null reviewer, timestamp, and resolution.

All ten records remain unapproved, evaluator-excluded, and score-ineligible. The package is reviewer-only and publication-ineligible; it authorizes no promotion or deployment.

- Artifact SHA-256: `21a4ff15eb74e35661db3a576765788276914129d18ff62e1f376f64470627e3`
- Package SHA-256: `dac0b4096d60194d0868f3ae097c23589df9aff0fc11df91a9b4e5575e350ac5`
- Review-record-set SHA-256: `fd834c4e6ff2cc6b09776489c2e026d11f66013470dae6eb2f0e823730f522c2`
- Event-evidence-set SHA-256: `b43d7da0c88db9387efc71e70322d59c804690d9f9548395b3d86e60d4fdbcfd`
- Decision-set SHA-256: `e93902a5af6dbe3a553ee2d78fc13676b62fc535857f52f9d1197ce03076694a`

The source-locked output has exactly two ordered direct parents: Connecticut evidence v3 and the event-dispositions receipt. The v3 evidence graph, ballot corpus, statutes, general-election statements, identity/geography evidence, and the four raw event API responses remain transitive lineage rather than duplicated direct parents. Both direct parents are reconstructed through their existing semantic validators during generation.

## Reproduction

```bash
npm run generate:ct-primary-evidence-review-v4
npm run test:run -- src/ingestion/elections/connecticut-primary-evidence-review-package-v4.test.ts
npm run typecheck
npm run data:verify
```
