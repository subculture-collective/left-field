# NJ/PA primary geography compatibility candidate v1

Status: **proposed reviewer evidence; nonpublishable and excluded from evaluation**.

This candidate accounts for the exact 41 observations in the immutable NJ/PA current-incumbent linkage package without changing or superseding that August 4 parent. It supplies evidence to the existing `approve-historical-district-cd119-compatibility-v1` decision. It does not resolve that decision, approve an identity or geography relationship, select a contest, calculate a primary value, change a score, or authorize publication. Its package explicitly binds `parentSourceCutoff: 2026-08-04` and `parentSuperseded: false`.

## Evidence and result

The retained Census Block Equivalency File page says the five states that redrew congressional plans for CD119 were Alabama, Georgia, Louisiana, New York, and North Carolina. NJ and PA are absent. Exact official TIGER archives independently close the district-key inventories for both sessions: 12 NJ and 17 PA districts in CD118, and 12 NJ and 17 PA districts in CD119.

- 16 observations from 2022 receive `official_no_plan_change_declaration_same_geoid_key_candidate`.
- 16 observations from 2024 receive `same_cd119_session_and_geoid_exact_key_candidate`.
- Nine NJ observations from 2026 remain `unassessed_cd120_authority_collection_pending`.
- 32 rows therefore carry compatibility evidence candidates; zero are approved or score-eligible.

The 2022 conclusion is intentionally a legal-plan continuity claim bounded by the official Census redraw scope and exact district inventories. Raw TIGER ZIP bytes and coordinate sequences differ between vintages. The generator does not compare raw geometry, infer that coordinate differences are plan changes, use an overlap threshold, or claim exact geometry equality. CD120 collection is still distinct from CD119, so the 2026 rows remain null rather than inheriting the current map by assumption.

## Immutable identities

- candidate file SHA-256: `e4f5594d073524b13bfd0e950cb897fdfae60f866489712b7a3c000efc81f9cf`
- package SHA-256: `cb662d10fcec1726518ac4329b16e2110ed4776d047b6b838421deb633f62a52`
- row-set SHA-256: `727b279d2ab5318bf79ea094ec8b47fc90073181c82049d90bcd12c16f7239a5`
- retained Census authority snapshot SHA-256: `66a0551a6c3c6432bff0a6a6db23f221fbe02ead1d15221d7050633898914670`
- NJ CD118 archive SHA-256: `f50511a1a6971143732e73b1941a96ad6968d0703f4a5236c597dbb00e0f63cf`
- PA CD118 archive SHA-256: `3e59d0b48b291c0ab626879b4d286b58506530706bcba6d0cfe767b531728a22`
- NJ CD119 archive SHA-256: `0bda6693ad95eaeccf6cf30e0d86842ae0928f36d8fc78b6cb9c4ac814fe2155`
- PA CD119 archive SHA-256: `63945666b675bc4ddc6b99e06e36b6fdb389c132937b880491c370f77f532ae8`

The retained raw sources are the [Census CD119 Block Equivalency File authority](https://www.census.gov/geographies/mapping-files/2025/dec/rdo/119-congressional-district-bef.html), [NJ CD118 TIGER archive](https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_34_cd118.zip), and [PA CD118 TIGER archive](https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_42_cd118.zip). The already locked CD119 source family supplies the target-session archives.

## Reproduction and safeguards

Run `npm run fetch:nj-pa-primary-geography-authority` only to reacquire the pinned source bytes; it fails on source drift. The retained snapshot supports offline review even if the live HTML changes. Run `npm run generate:nj-pa-primary-geography-v1` to reproduce the immutable candidate. The generator independently hashes every parent and all four extracted DBF members, verifies exact source-lock paths/status/kinds, parses the TIGER DBF session and district inventories, binds every linkage and contest hash, sorts rows bytewise, and refuses to overwrite differing output.

Focused tests cover lifecycle closure, cycle/session semantics, the explicit CD120 pending state, linkage containment, TIGER state/session closure, source-lock path and kind substitution, wrong-session DBF evidence, and immutable package validation. Candidate rows contain no candidate name, address, contact, donor, raw geometry, or raw authority text.

## Reviewer consequence

Recommended decision support: accept these 32 relationships as strong evidence for the existing historical-geography decision while keeping all primary values excluded until identity and geography review are explicitly resolved. If the reviewer rejects the Census redraw-scope rule, the safe default remains exclusion and a separately reviewed block-level crosswalk is required. The nine CD120 rows remain unaffected either way.
