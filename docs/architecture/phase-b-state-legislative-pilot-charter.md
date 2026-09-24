# Phase B state-legislative pilot charter

## Status

**Implementation-ready foundation; no state is qualified as a Phase B pilot yet.**

This charter is a local planning and intake assessment as of 2026-08-20. It does not establish production coverage, publication approval, current source availability, or election certification beyond the retained source artifacts named below. The federal catalog, release-health checks, address lookup, public routes, and House Priority Index remain outside this charter.

## Pilot acceptance gate

A state can enter the Phase B pilot only after one source-bound package covers each requirement below for a declared election cycle and source cutoff. A discovery source may identify work, but cannot satisfy an official-result, filing, or certification requirement.

| Requirement | Minimum retained evidence | Current rule if absent |
| --- | --- | --- |
| Office and district universe | Official legislature/election authority roster or district catalog, including chamber, district, and effective dates | `not_collected`; no universe claim |
| Candidate filing | Official filing list or ballot certification with office natural key and party/nonpartisan status | `not_collected`; no candidate or incumbent inference |
| Results and certification | Official contest-level result plus a retained certification/canvass instrument appropriate to the authority | `not_collected` or `not_reported`; do not infer winner/nominee |
| Election calendar | Official election date, filing deadline, and rule/rule-change source | `not_collected`; no runway calculation |
| Finance | State campaign-finance authority with candidate/committee link, filing period, and amendment handling | `source_unavailable` until retained and reconciled |
| Geography | Official or Census-compatible district artifact and a documented cycle/plan mapping | `not_defensibly_modeled`; no cross-cycle comparison |
| Election-system diversity | Explicitly classify partisan, nonpartisan, multimember, term-limited, runoff, and other systems that occur in the pilot | `unknown`; exclude from formula work |
| Missingness | Count expected offices/contests, observed rows, quarantined rows, and reasons for every omission | reject the package as pilot coverage |

Formula eligibility is a separate, later gate. It requires an explicit state-level formula program that names supported office families, selection and election methods, district magnitude, factual inputs, source cutoff, and missing-data treatment. No retained state/local artifact passes this gate.

## Current retained intake inventory

The local-context receipt is a provenance index, not a national catalog. v16 contains 18 retained artifacts and reconciles a prior index omission: the source-locked Indiana local-office receipt existed in the repository, status read model, source-coverage note, and its own validator, but was not a v15 coverage-index child. v16 retains v15 unchanged and adds that receipt with its existing SHA-256 and zero formula-eligible count.

| Retained package group | Classification | Why it is retained | Formula state |
| --- | --- | --- | --- |
| County demographics; county election context | Research/discovery context | County-level context does not establish an elected office, contest, or office geography | Ineligible |
| 2022/2024 county House and 2024 county Senate projections | Research fallback | Incomplete/archive-derived context; not uniform official local canvasses and no district allocation | Ineligible |
| Alabama, Delaware, Georgia, Hawaii, Indiana, Kentucky, Missouri, North Carolina, Ohio, Tennessee state-legislative results | Source-bound state-legislative context | Official-source result observations for specified cycles; retained scope varies and does not supply the complete Phase B gate | Ineligible |
| North Carolina local-office results | Source-bound local context | Local contest observations with mixed partisan/nonpartisan systems, without a unified elected-office universe | Ineligible |
| New Mexico county-office results | Quarantined/source-bound local context | Eight contests are expressly quarantined; retained records remain local context, not a pilot universe | Ineligible |
| Indiana local-office results | Source-bound local context, now indexed | Certified 2024 archive preserves 12 source categories, 682 office rows, 816 party contests, 1,520 candidate rows, and multi-seat/source-winner fields; normalized local jurisdictions and current-holder identity are absent | Ineligible |

`catalog-only` is reserved for a future office-universe record that has a source-bound office/body and selection method but lacks sufficient election or finance observations. None of the rapid result receipts is promoted to a catalog-only office record by this charter: source result titles and category IDs alone are not a complete hierarchical office universe.

## Candidate-state assessment

The retained state-legislative packages are useful evidence of result-adapter work, not proof that their state qualifies. The matrix intentionally uses `not assessed from retained intake` rather than treating a missing package as a negative fact about the state.

| Candidate | Retained result context | Strength to exercise | Blocking Phase B evidence |
| --- | --- | --- | --- |
| Indiana | 2022/2024 state-legislative results; 2024 local result archive | Separate state and local source families; local multi-seat records | Authoritative office/district universe, filings, calendar, finance, cycle geography, explicit selection/election-method coverage, and missingness matrix |
| North Carolina | 2022/2024/2026 state-legislative results; mixed local-office corpus | State and local systems; partisan/nonpartisan local observations | Filed-candidate and certification package, finance adapter, office universe, state-legislative geography mapping, and complete missingness closure |
| Georgia | 2022/2024/2026 regular-primary state-legislative results | Multi-cycle regular-primary adapter | Filing/calendar/finance/geography evidence and a source-bound classification of non-primary or special-election cases |
| Ohio | 2024/2026 Democratic state-legislative official-canvass context | Narrow party-specific official-canvass adapter | Republican/other required scope decision, office universe, filings, calendar, finance, geography, election-method assessment, and missingness matrix |
| Alabama, Delaware, Hawaii, Kentucky, Missouri, Tennessee | Retained official result-context packages with state-specific scopes | Useful adapter comparison cases | Same full gate; no retained package establishes all eight requirements |

Recommendation: do not select a production or formula pilot. The smallest safe next selection activity is a **read-only, source-locked qualification packet** for Indiana and North Carolina. It should establish the office/district universe, source authority hierarchy, filing/calendar/finance availability, election-system inventory, geography version, and explicit missingness before choosing either state. Georgia and Ohio are valuable comparison cases but have the same unresolved gate, so they should not expand scope first.

## Additive implementation boundary

`src/domain/contracts/office-universe.ts` is the Phase B intake boundary. It adds no database table, migration, public route, address behavior, or federal projection. The contract requires:

- a parent-linked jurisdiction and source natural key;
- a governing body distinct from an office;
- source-native and normalized titles, catalog scope, government level, office family, selection method, election method, partisan status, and district magnitude;
- provenance on every record and versioned term dates; and
- a fail-closed formula-eligibility record: an office is eligible only with an explicit formula program and no missing required inputs.

This is intentionally a contract/projection seam rather than a persistence migration. A forward persistence migration is deferred until a source adapter can supply stable jurisdiction and office natural keys plus a tested federal parity projection. That avoids adding empty local tables that could imply coverage or weaken the existing 541-seat / 56-jurisdiction release invariant.

## Next smallest safe steps

1. Retain and validate one authoritative Indiana or North Carolina office and district universe, including parent jurisdictions, body identity, selection method, and source-native title.
2. Retain source-bound filing, calendar, finance, and certification evidence for the same declared cycle; write missingness rather than filling gaps.
3. Build adapter fixtures into the office-universe contract and add a separate forward migration only after those fixtures prove stable natural keys.
4. Add a formula program only after its factual input dictionary and incompatible-election-system exclusions are reviewed. Until then, retain zero formula-eligible state/local records.
