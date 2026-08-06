# Virginia primary geography compatibility candidate v1

Date: 2026-08-06
Status: proposed reviewer-only candidate; not approved, score-bearing, published, or deployed

## Result

The candidate binds all twelve Virginia identity observations one-to-one. Six 2022 rows are CD118-to-CD119 plan-continuity candidates because the retained Census authority identifies only Alabama, Georgia, Louisiana, New York, and North Carolina as CD119 redraw states, Virginia is absent, and the exact target GEOID is present in both complete official inventories. Six 2024 rows are exact CD119 same-session/key candidates.

Both embedded DBFs contain exactly 11 active numbered Virginia districts, GEOIDs `5101`–`5111`, and no special row. CD118 records session `118`; CD119 records session `119`. This evidence does not claim ZIP or raw geometry equality, calculate overlap, establish population equivalence, or approve a relationship.

The three proposed identity links, the 2024 VA-11 predecessor no-match, and eight identity-unassessed absent-result rows are preserved exactly. The four present contests retain official-result and event-level-certification status; the other eight retain null contest/result fields. Geography never creates a candidate, winner, zero, uncontested, or no-primary disposition.

Artifact: `data/metadata/virginia-primary-geography-compatibility-candidate-v1.json`
Artifact SHA-256: `b4309ff23ab9b32fe6be76705b5fce436b2228abb64cc86860ae2c3ac39df23c`
Package SHA-256: `0a470c2b402997e778c08f7b93c8ded614a41f053ea6e990f1af05fb25121920`
Row-set SHA-256: `5a191d63d50302b35e8e3f323fc3628dad11cb6c6eabf591d46c2260e0b36f69`
Parent-projection SHA-256: `bc5c5b2f36e3094927bb6ab27fb8e47fe887553b8bd362f0d4b917754290adc0`

All identity and compatibility approvals remain false, evaluator use remains excluded, and all twelve rows are score-ineligible. The source-lock output binds the source-selection proposal, Virginia result receipt, identity candidate, Census plan-change authority, and exact CD118/CD119 Virginia archives.

## Reproduction

```bash
npm run generate:va-primary-geography-v1
npm run test:run -- src/ingestion/elections/virginia-primary-geography-compatibility-candidate.test.ts
npm run typecheck
npm run data:verify
```
