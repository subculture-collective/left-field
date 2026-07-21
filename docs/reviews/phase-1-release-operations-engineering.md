# Phase 1 release-operations engineering evidence

## Milestone

**repository release-operations engineering complete; production telemetry and real R2/R3/R4 publication blocked**.

This records mechanism evidence, not a production deployment. Synthetic mechanism evidence only was observed; production telemetry was not observed.

## Implemented contracts

- `release:health` takes exactly `--release rel_...` and only a restricted preflight connection. Its sanitized JSON contains counts, statuses, and durations—not connection details or receipts. It verifies universe (541 seats: 441 House, 100 Senate), geometry (497 valid), provenance, coverage/quarantine, current ingest failures, the seven-domain gate, and bounded repository smokes. It marks production telemetry `not_observed` and launch blockers accordingly.
- Operational signals are strict, bounded v1 JSONL shapes for ingestion, lifecycle, repository, and address outcomes. They exclude payloads, addresses, coordinates, URLs/locators, credentials, and exception detail; delivery is opt-in, serialized, best-effort, bounded, and has no default durable sink or retry. `releaseId`, `runId`, and `sourceId` are JSONL correlation fields only, never metric label dimensions.
- `release:drill` is a disposable local contract: exact opt-in, nonproduction, one loopback `*_test` target, and five distinct role logins. It verifies role separation, writer freeze, stale/expired-proof rejection, five domain invalidations, immutable preservation, rollback, and roll-forward. Three complete web-role browse/profile/source/coverage smoke phases bind the published pointer after promotion, rollback, and roll-forward. Its result is explicitly `local-synthetic`.

## Verified results

- Fresh database `dsa_seats_task14_final_test`: immutable migrations `0000`–`0005` applied; the guarded PostgreSQL suite passed **35/35** in about **537 seconds**. This includes the five-principal synthetic drill, five-domain invalidation probes, stale/expired-proof rejection, restricted-preflight health, three web-role smoke phases, rollback, and fresh-proof roll-forward.
- The non-guarded suite passed **567 tests across 72 files**; the same 35 guarded cases were skipped only in that command and passed separately above.
- TypeScript, ESLint (one pre-existing unused-variable warning), Next production build, the **96-entry** source lock, zero-vulnerability npm audit, Compose validation, **70-table** Drizzle no-drift generation, and diff checks passed.
- The existing seeded Task 13 browser gate was rerun after the profile source-closure performance correction and passed **32/32** in desktop Chromium and exact 390px Chromium, including Axe A/AA and strict console/network/5xx guards.
- Final review dispositions: Oracle **APPROVED**, observability/system-watch **APPROVED**, and SRE/uptime **APPROVED**.

The checked-in Task 10 lifecycle evidence separately verifies map-specific restricted-role and immutable-object controls. These results remain local mechanism evidence; they do not establish production credentials, storage retention, telemetry delivery, or any real R2/R3/R4 publication.

## External blockers

- Production telemetry remains `not_observed`; the JSONL sink is opt-in, best-effort, local evidence only.
- Real R2 finance publication remains blocked by the documented source, mapping, licensing, and immutable-contract gates.
- Reviewed nationwide R3 election publication remains blocked by missing reviewed source/geometry/policy evidence.
- R4 promotion remains blocked by the absence of a publishable R3 predecessor and production map-retention/runtime-credential evidence.
- Correction intake and address lookup remain disabled pending their separate trusted-edge/privacy/retention approvals.

See [`release-runbook.md`](../operations/release-runbook.md), [`source-coverage.md`](../data/source-coverage.md), and Task 8–13 evidence in this directory.
