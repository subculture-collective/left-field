# Nationwide office-universe intake runtime

The `office_universe` schema is an additive, non-public operational context for state and local intake. It has no foreign keys to the federal release, `public.offices`, or `public.seat_cycles` tables. It must not be included in a federal release manifest or exposed through the existing public routes.

## First database setup

1. Apply the normal repository migration workflow through `0017_nationwide_office_universe_intake` to the intended local/staging database.
2. Run `OFFICE_UNIVERSE_DATABASE_URL=<explicit local-or-staging URL> npm run seed:nationwide-office-universe-registry`.
3. Confirm that 250 source-registry rows exist: five source-family slots for each of the 50 states.

The seed intentionally configures only the two shared national discovery sources. State elections, finance, and officeholder slots begin as `authority_unavailable`, with no guessed endpoint. This is an explicit acquisition backlog, not a claim that the state lacks an election authority.

## Intake states

- `accepted` raw payloads are retained even when their office universe, finance, geography, filing, or certification facts are incomplete.
- `quarantined` payloads retain the immutable raw receipt plus sanitized issue records. A bad record does not reject its batch.
- `reported_result` and `provisional_winner` can feed only the provisional workspace.
- `certified_winner` can feed a compatible certified formula program after its required factual inputs are complete.
- A provisional primary or November winner creates `holder_pending_transition`; it never overwrites `current_holder` before the term's sourced effective date.

## Manual shadow runs

`runReviewedSource` in `src/office-universe/run-source.ts` is the only allowed way to run a source, and it is invoked by hand. It refuses, before writing anything, a source whose status is not `reviewed` or that fails `reviewSourceDefinition`, a `requestedCutoff` that is not an ISO 8601 UTC instant ending in `Z`, and a receipt that is not verified (`verified: true`, or re-verified through `verifyRetainedObject` when a `rawStoreRoot` is supplied).

A run then retains every raw row through `retainRawIntake` under the source's `privacyPolicy`, aggregates the row decisions and the receipt with `assessSnapshot`, and appends, in order: the receipt plus one `intake_runs` row already carrying its terminal status (`succeeded` for `accepted` and `accepted_with_row_quarantine`, `failed` for `quarantined`) and `finished_at`; one `intake_snapshots` row; and one `snapshot_issues` row per systemic issue. `intake_runs` has `CHECK ((status='running') = (finished_at IS NULL))` and the ingest role has no UPDATE grant, so a run is never inserted as `running` and later updated. Run and snapshot ids are a SHA-256 of source id, cutoff, and receipt digest, so a replay names the same evidence and conflicts with `DO NOTHING` instead of rewriting it.

The run's `IntakeRepository` exposes only `retainRawIntake`, `recordRun`, `recordSnapshot`, and `recordSnapshotIssues`. It has no graph projection, coverage, formula, holder, scheduler, or retry method, and `normalizedRecordCount` is always `0`: a shadow run produces evidence and a disposition, not domain rows.

## Refresh behavior

`refresh-policy.ts` is advisory only. It computes the interval a configured source would be eligible for (15-minute polling for election sources in the election-night window, weekly discovery, nightly/daily finance and officeholder slots, daily backlog revisits for unconfigured slots) but nothing reads it to start a run. Only manual reviewed runs are allowed; an eligible interval is not authorization to acquire or run.

## Opt-in readiness proof

`src/office-universe/pilot-readiness.integration.test.ts` proves the pilot-readiness contract against one database that the operator names explicitly. It never infers a target: without `OFFICE_UNIVERSE_DATABASE_URL` the suite skips, and it refuses to start when the URL's database name does not end in `_test` or when `NODE_ENV` is `production`. Production and implicit targets are forbidden; the database must be disposable, because the proof migrates it, truncates every `office_universe` evidence table it writes before and after, and creates then drops a temporary LOGIN role.

Run it against a local or staging database that you created for this purpose:

```sh
OFFICE_UNIVERSE_DATABASE_URL="postgresql://<user>:<password>@127.0.0.1:<port>/<name>_test" npm run test:run -- src/office-universe/pilot-readiness.integration.test.ts
```

With the URL set, the proof applies the `drizzle/` migrations, seeds the registry twice (250 inserted, then 0), inserts the synthetic reviewed source from `fixtures/qualified-source.ts`, verifies a synthetic retained object under a temporary raw-store root, runs `runReviewedSource` once accepted and once quarantined, and asserts the resulting `intake_runs`, `intake_snapshots`, `snapshot_issues`, and `retained_object_receipts` rows. It then connects as a LOGIN member of `dsa_seats_ingest` to show INSERT succeeds while UPDATE and DELETE on those four tables fail with `42501`, and it asserts that every `public`-schema table has the same row count before and after. The connecting user must be able to create roles (superuser or `CREATEROLE`).

## Current boundary

This implementation supplies the nationwide platform, 50-state registry, persistence model, raw/quarantine semantics, holder lifecycle, and calculation isolation. It does **not** acquire, publish, certify, or claim complete state/local election coverage. State-specific official endpoints and any aggregator contracts must be retained and reviewed before those slots become `configured`.
