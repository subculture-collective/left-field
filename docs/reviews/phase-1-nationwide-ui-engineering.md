# Phase 1 nationwide UI engineering evidence

Task 13 closes the nationwide factual read model and durable browser gate. It does not mutate a release, add ranking or demographic controls, activate address lookup, or claim public launch. The seeded browser release is synthetic UI mechanism evidence only.

## Implemented boundary

- Browse and profile records expose canonical voting-member, Delegate, Resident Commissioner, and Senator labels. V2 profiles use persisted jurisdiction policy for Senate representation; only schema-v1 profiles use the explicit legacy fallback.
- `/sources` uses a fixed-cardinality, homogeneous coverage aggregate read. Release, jurisdiction, seat-cycle, ACS variable/period, election year, and finance funding-kind units remain distinct; counts, missing reasons, and distinct snapshot counts are preserved.
- The shared shell describes nationwide factual records without asserting completeness. Browse/source tables are named keyboard-scroll regions, and global errors provide retry and return paths.
- `test:e2e:task13` owns a disposable `_test` database, dedicated local map root, migrations, synthetic map seed, available port, desktop Chromium, and exact 390px Chromium. It fails on missing configuration, `.only`, skips, console errors, request failures, 5xx responses, or Axe findings.

## Evidence

- Mandatory seeded browser gate: **32/32 passed** across desktop and exact 390px. It covered browse, profile, sources, methodology, empty/invalid/missing states, map and boundary ledger, correction entry/flow, disabled lookup, keyboard-scroll tables, and Axe WCAG A/AA. The local fixture never contacted Census and is not release-publication evidence.
- Guarded PostgreSQL integration: **34/34 passed** on a fresh `0000`–`0005` database. The legacy Task 7–9 scenario's timeout was raised narrowly from 300 to 360 seconds after it passed alone in 283.72 seconds; no assertion or production behavior changed.
- Non-guarded Vitest: **509 passed across 68 files**, with the same 34 guarded cases skipped only in that command.
- TypeScript, ESLint (zero errors; one pre-existing unused-variable warning), Next production build, 96-entry source lock, zero-vulnerability npm audit, Compose validation, 70-table Drizzle no-drift generation, and diff checks passed.
- Final Oracle and designer reviews approved the corrected implementation and evidence without blockers.

The current published release and all release digests remain unchanged. Production publication remains blocked by the documented Task 8/9 source gates and Task 12 external privacy activation gate.
