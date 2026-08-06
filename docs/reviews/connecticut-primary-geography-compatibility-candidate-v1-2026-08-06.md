# Connecticut primary geography compatibility candidate v1 — 2026-08-06

## Outcome

This reviewer-only artifact proposes ten historical-to-current U.S. House geography relationships for Connecticut districts 01–05 in 2022 and 2024. It binds every row to the exact nomination-authority and current-identity parent observation. All nomination and result statuses remain null; no row is identity-approved, geography-approved, selected, score-eligible, publication-eligible, or authorized for evaluator use.

| Cycle | Official evidence | Rows | Disposition |
|---|---|---:|---|
| 2022 | Census CD119 redraw declaration excludes Connecticut; exact official CD118 and CD119 inventories both contain GEOIDs 0901–0905 | 5 | `official_no_plan_change_declaration_same_geoid_key_candidate` |
| 2024 | Historical and target geography both use CD119; the official inventory contains exact GEOIDs 0901–0905 | 5 | `same_cd119_session_and_geoid_exact_key_candidate` |

Both inventories also contain `09ZZ`. Census documents this as Connecticut unassigned water, not an elected district. The builder validates exactly one sentinel in each layer and emits no `ZZ` row.

## Evidence boundary

The candidate does not assert byte-identical geometry, overlap, population equivalence, nomination, ballot placement, primary outcome, certification, or historical incumbency. The five 2022 rows use official plan-continuity evidence plus matching district keys; the five 2024 rows use an exact CD119 session and key. Human review remains required for identity, geography, and publication.

The six direct parents are the unresolved source-selection proposal, privacy-filtered Connecticut nomination receipt, proposed Connecticut identity linkage, Census CD119 plan-change authority, and the official Connecticut CD118 and CD119 TIGER archives.

- Artifact: 19,878 bytes; SHA-256 `0012e0c97b183f7f8e110f70e892b15488c6a1b0ddd202c4184c42153a17bd82`
- Row set: `a72034dde62cb6205dbe6596799858c8bfa71d843905ba5ba984a6b83808ca38`
- Package: `c246985059dc1c530bdf87788c49e14244a4a22ab169ec90c27567b5f74f4978`

```bash
npm run generate:ct-primary-geography
npm run test:run -- src/ingestion/elections/connecticut-primary-geography-compatibility-candidate.test.ts
npm run data:verify
```

The next bounded step is a joint identity/geography reviewer package. Final Democratic candidacy or ballot closure, statutory cancellation/nomination authority, general-election nominee cross-check, progressive classification, reviewer decisions, promotion, and deployment remain separate unresolved work.
