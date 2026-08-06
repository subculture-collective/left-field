# Texas primary geography compatibility candidate v2

## Outcome

Texas geography v2 composes the immutable 78-row geography v1 parent with the complete PlanC2333-to-CD119 block-crosswalk candidate. It preserves all 26 CD118-to-CD119 plan-continuity candidates for 2022 and all 26 exact CD119 session/key candidates for 2024. The 26 regular/runoff observations for 2026 now carry retained, row-hash-bound PlanC2333 block evidence instead of a collection-pending placeholder.

All thirteen in-scope PlanC2333 districts split across CD119 districts. Consequently, all 26 event rows are `crosswalk_review_required`, no 2026 compatibility candidate is created, and the package still contains exactly 52 compatibility candidates overall. Every approval remains false; review identity, timestamp, and resolution remain null; evaluator values, score eligibility, publication eligibility, and deployment claims remain absent.

The composition preserves all parent event IDs, regular/runoff stages, source-observation states, contest IDs and hashes or nulls, winner markers, identity row hashes, certification states, and result dispositions. Each 2026 row includes the exact crosswalk row hash, source and target block counts, split vector, and time-bounded PlanC2333 authority state. District-number continuity and overlap percentages are not promotion rules, and block counts are not population, voter, partisan, or electoral weights.

The generated artifact is 187,351 bytes with file SHA-256 `8cf09b2b0f7250a7cca6acb2dc08ad67769b0837beaaa9b736cef51849eabf67`, package SHA-256 `ce68de1820b1e5763f34c722ac79f6722f21ad4a53eecc39166ebd70c5fe3036`, and row-set SHA-256 `35bd41317eba6bc40e649e4b4ba13c0c1db06c51c5405951038b05dceb0ef526`.

## Reproduction

```bash
npm run generate:tx-primary-geography-v2
npx vitest run src/ingestion/elections/texas-primary-geography-compatibility-candidate-v2.test.ts
npm run data:verify
```

The next composition is Texas joint review v2. It must preserve all 78 identity/result records and all five unresolved reviewer decisions while replacing only their geography evidence projection with this v2 parent.
