# Phase B pilot advancement decision — 2026-09-25

**Decision:** neither Indiana nor North Carolina advances. Both packets record `not_qualified`.

This is the evidence-linked decision required by roadmap #2 (issue #15). It configures no source, authorizes no acquisition or publication, and claims no coverage. Zero qualified states is the valid outcome under the charter.

## What was reviewed

| Input | Location | Finding |
| --- | --- | --- |
| Indiana packet | `docs/data/office-universe/indiana-state-legislative-qualification.md` | `not_qualified`; all eight gates `not_collected` |
| North Carolina packet | `docs/data/office-universe/north-carolina-state-legislative-qualification.md` | `not_qualified`; all eight gates `not_collected` |
| Packet schema | `docs/data/office-universe/qualification-packet-schema.md` | Advancement needs every gate `retained`, no systemic quarantine, a bound reviewed source, replay, and a recorded manual shadow run |
| Source-lock verification | `npm run data:verify` | 1,205 entries verified; no Indiana or North Carolina artifact covers a 2024 general-cycle state-legislative office universe, filing list, certification instrument, calendar, finance, or geography plan |
| Readiness proof | `src/office-universe/pilot-readiness.integration.test.ts` | Passed twice on 2026-09-25 against a local disposable PostGIS database (`dsa_seats_pilot_readiness_test`): migrations apply, the registry seeds 250 rows then 0, a synthetic reviewed source completes accepted and quarantined shadow snapshots, the ingest role cannot update or delete evidence, and public tables are unchanged |

## Unmet gates, by state

Every gate is unmet in both packets. The retained rapid primary-result receipts (`rapid-indiana-state-legislative-primary-results-v1`, `rapid-north-carolina-state-legislative-primary-results-v1`, and the two local-office receipts) are context only: they record primary contests, not a general-election office universe, and carry no retrieval timestamp at or before the packet cutoff. The Open States rosters retained on 2026-09-24 postdate the cutoff of 2026-08-04 and are listed under missingness.

| Gate | Indiana | North Carolina |
| --- | --- | --- |
| office_district_universe | not_collected | not_collected |
| filing | not_collected | not_collected |
| results_certification | not_collected | not_collected |
| calendar | not_collected | not_collected |
| finance | not_collected | not_collected |
| geography | not_collected | not_collected |
| election_system_diversity | not_collected | not_collected |
| missingness | not_collected (recorded) | not_collected (recorded) |

## What the proof does establish

The runtime side of the charter is in place and verified: reviewed-source contracts fail closed, evidence tables are append-only for the ingest role, retained objects are verified before intake, and a manual shadow run has no graph, coverage, formula, holder, or scheduler effect. None of that is state evidence. A state advances only when a packet is rebuilt with retained artifacts for all eight gates and a manual shadow run against that packet is recorded.

## Next step, if pursued

Retain an official 2024 general-cycle office and district catalog for one state with a recorded retrieval time, then rebuild that state's packet. This document does not authorize that acquisition.
