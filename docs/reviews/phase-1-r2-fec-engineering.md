# Phase 1 Task 8 FEC engineering evidence

## Acceptance scope

Task 8 is accepted as **fail-closed engineering complete; nationwide finance publication blocked**. No real R2 finance candidate was mutated or promoted. The active published release is unchanged.

The implementation provides:

- a canonical sanitized OpenFEC envelope that is the sole retained replay authority;
- deny-by-default OpenFEC request construction without Schedule A or itemized donor data;
- exact request, response, pagination, raw-object, source-lock, mapping, and staging bindings;
- official inclusive amendment-chain resolution and exact-cent multi-committee aggregation;
- an atomic candidate finalizer, loaded-run restart, and concurrent shared verifier;
- profile finance coverage, gross aggregate inputs, filing history, committee closure, and source closure.

Schedule E by-candidate data remains cycle-scoped and is never written as exact-election outside spending. Current materialized candidate totals are not acquired because OpenFEC cannot constrain them to the release cutoff. Restricted production adapter snapshots cannot finalize as publishable facts.

## Synthetic mechanism evidence

The guarded PostgreSQL scenario `finalizes Task 7 ACS and guarded synthetic Task 8 FEC candidate-only data` uses production-shaped fake FEC IDs and explicitly approved synthetic source metadata in a disposable release. It proves:

- raw replay mismatch rolls back without finance rows, run transition, or checksum change;
- all amendment versions and internal predecessor links persist atomically;
- the selected aligned scope produces one gross aggregate with exact committee inputs;
- finance coverage closes through both the reviewed mapping snapshot and FEC envelope snapshot;
- Task 7 remains valid, all seven release digests and the gate revalidate, and the release stays candidate-only;
- exact finalization restart is idempotent;
- two concurrent shared verifiers complete without lock escalation or deadlock;
- the profile exposes aggregate, filing, committee, coverage, and source closure without publishing Schedule E rows.

Fresh-database command:

```bash
DATABASE_URL=postgresql://dsa_seats:dsa_seats@localhost:5432/dsa_seats_task8_test npm run db:migrate
TEST_DATABASE_URL=postgresql://dsa_seats:dsa_seats@localhost:5432/dsa_seats_task8_test npm run test:integration -- -t "Task 7 ACS and guarded synthetic Task 8 FEC"
```

Result: 1 passed, 28 skipped by the name filter, approximately 51 seconds. Immutable migrations remain `0000`–`0002`.

The final clean repository gate passed 390/390 tests across 46 files, strict TypeScript, ESLint, the Next production build, 94-entry source-lock verification, zero-vulnerability audit, Compose validation, and zero Drizzle drift.

## Publication blockers

Nationwide finance publication remains blocked independently by:

1. no production `FEC_API_KEY` or retained nationwide OpenFEC envelope receipts;
2. no reviewed real FEC candidate/cycle mappings to current R2 candidacies;
3. restricted FEC licensing/usage status;
4. no historical-cutoff candidate-total endpoint;
5. no exact-election selector on Schedule E by-candidate aggregates;
6. valid signed OpenFEC summary values that the immutable nonnegative public contracts cannot represent.

Missing credentials remain `not_collected`; they do not prove `source_unavailable` or `license_unavailable`. Donor identities are never collected or retained.

## Review

Oracle approved the final Task 8 implementation after review of amendment semantics, transport/privacy limits, provenance binding, exact request hashes, finalizer invariants, aggregate profile closure, and the PostgreSQL mechanism evidence. Security review approved the sanitized acquisition boundary.
