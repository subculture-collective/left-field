# Virginia current-incumbent primary identity candidate v1

Date: 2026-08-06
Status: proposed reviewer-only candidate; not approved, selected, score-bearing, published, or deployed

## Result

The candidate closes an exact twelve-row denominator: six current Virginia Democratic target seats crossed with the two retained official historical result cycles, 2022 and 2024. It binds the production target roster, unresolved nationwide source-selection proposal, House Clerk MemberData, Congress Legislators Current, Virginia result receipt, and their exact source-lock entries.

Three relationships are proposed and none is approved:

- 2022 VA-08: `Donald S. Beyer, Jr.` is an exact normalized official-name observation for current BioGuide `B001292`. The source does not mark a winner, and vote order or totals are not used to infer one.
- 2024 VA-07: `Eugene S. Vindman` is a finite derived relationship to Clerk/Congress official name `Eugene Simon Vindman`, limited to the same district and the independently corroborated middle-initial expansion.
- 2024 VA-10: `Suhas Subramanyam` is an exact normalized official-name observation for current BioGuide `S001230`.

The 2024 VA-11 contest names source-marked winner `Gerald E. "Gerry" Connolly`. It remains an explicit predecessor/no-current-incumbent-match row and is never linked to current BioGuide `W000831`, James R. Walkinshaw. The other eight target-cycle rows have no reported target-district contest in the retained official result evidence. They retain null contest, candidate, vote, winner, and identity evidence rather than becoming zero, uncontested, no-candidate, or no-primary facts.

Artifact: `data/metadata/virginia-current-incumbent-primary-linkage-candidate-v1.json`
Artifact SHA-256: `ca318b9782f8c42813497a991dc151ecf07841aee3cde7aa6a310b521c53fa56`
Package SHA-256: `6090c0d73dff58746d56bef48252b561bef2eedf4cb4ab390e0799071c97da52`
Observation-set SHA-256: `017958f7adad4054c58e8069ee856a29d8cb265f0e237deebdfb1b97c9d0f778`

## Authority and 2026 exclusion

The four present target contests inherit `official_result_retained` and `event_level_board_certification_retained_no_individual_certificate` exactly from the Virginia results receipt. Event-level certification does not become an individual signed contest certificate, identity approval, nominee conclusion, or reviewer authorization. Source winner markers are retained only as contextual source evidence.

The five August 5, 2026 source snapshots are explicitly unofficial and contribute zero identity rows. In particular, the snapshot's VA-08 Donald Beyer name cannot enter this certified-history candidate, and absence of the other target districts cannot establish any disposition. A future certified 2026 result requires a separately versioned receipt and identity candidate.

## Lifecycle and integrity

All twelve rows have `identityApproved: false`, `selected: false`, and `scoreEligible: false`; evaluator use is excluded pending identity, geography, disposition, classification, and publication review. The package is reviewer-only and publication-ineligible. The derived name relationship, source authority, historical geography, nonstandard-disposition treatment, progressive classification, and human publication approval remain unresolved.

The validator pins the exact five parent files and complete source-lock entries, including ancestry; both official identity sources; current seat/BioGuide/district/name closure; the fixed twelve-row keyspace; all copied contest and candidate facts through row hashes; the observation-set hash; the package hash; and the output artifact's byte size, hash, kind, and parent list. Tests reject fully rehashed attempts to import 2026 evidence, cross-link Connolly to Walkinshaw, turn absence into zero, fabricate approval/selection/scoring, add unknown claims, publish the package, or alter output ancestry.

## Reproduction

```bash
npm run generate:va-current-incumbent-primary-linkage-v1
npm run test:run -- src/ingestion/elections/virginia-current-incumbent-primary-linkage-candidate.test.ts
npm run typecheck
npm run data:verify
```

The next independent artifact is the historical-geography compatibility candidate. The retained CD118 authority permits a bounded 2022 plan-continuity proposal and 2024 CD119 exact-key observations, but this identity package itself makes no geography claim.
