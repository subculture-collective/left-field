# Release operations runbook

## Safety boundary

Do not place connection strings, keys, addresses, or raw receipts in shell history, logs, tickets, or command lines. Inject secret values through the approved secret manager. Stop on any failed gate; do not retry a failed candidate by mutation. Preserve its receipts and quarantine/review the failed source or candidate before a new validated attempt.

Use distinct least-privilege connections: migration owner `DATABASE_URL`; ingest `INGEST_DATABASE_URL`; read-only preflight `RELEASE_PREFLIGHT_DATABASE_URL`; lifecycle operator `RELEASE_OPERATOR_DATABASE_URL`; web `WEB_DATABASE_URL`; corrections `CORRECTION_DATABASE_URL`; address admission `ADDRESS_DATABASE_URL`. `release:health` accepts only the preflight URL and verifies the session's exclusive `dsa_seats_release_preflight` role membership inside PostgreSQL; username spelling is not authorization.

## Local, disposable mechanism commands

Run migrations only as the migration owner:

```bash
npm run db:migrate
```

Run repository gates:

```bash
npm run data:verify
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Inspect one release with the restricted preflight role (replace the placeholder with an actual `rel_...` identifier):

```bash
npm run release:health -- --release <rel_release_id>
```

The JSON report is deliberately sanitized to counts/statuses/durations. It checks the 541/441/100 universe, 497 valid geometries, source/snapshot status, coverage/quarantine count, unresolved current ingestion runs, seven-domain gate, and bounded repository reads. A local repository gate is clean only when `repositoryStatus` is `pass`. Overall production readiness remains non-pass because production telemetry is explicitly `not_observed`; this is not launch approval.

Run the lifecycle drill only on one loopback `*_test` database, with five distinct LOGIN users, nonproduction `NODE_ENV`, and `RELEASE_DRILL_OPT_IN=RUN_SYNTHETIC_RELEASE_DRILL` already supplied by the disposable test environment:

```bash
npm run release:drill
```

The drill rejects production, non-loopback, non-`*_test`, shared-user, parameter-overridden, or multi-target configurations. Its successful JSON is local synthetic evidence only; it attests roles, invalidates five domains, rejects stale/expired proofs, and performs three full web-role browse/profile/source/coverage smoke phases after promotion, rollback, and roll-forward while proving immutable preservation.

## Candidate and release gates

Before any external lifecycle action: verify the source lock; migrate; require `repositoryStatus=pass` in the health report for the exact release; require no unresolved current ingest run; review quarantined counts rather than assuming zero; recheck the seven-domain validation gate; and run release-addressed browse/profile/sources/coverage smoke reads. Retain the resulting sanitized outputs with the release record. A blocked/not-run production-readiness result must never be described as green or launch-ready.

Stage only with the ingest role via the existing `npm run ingest` command. Finalize only through the matching existing command: `npm run finalize:nationwide`, `npm run enrich:members`, `npm run finalize:acs`, `npm run finalize:fec`, `npm run finalize:elections`, or `npm run finalize:maps`. Each parser requires its exact documented arguments, source receipts, source-lock binding, and finalizer-specific storage environment; do not guess arguments or use these commands to construct an unreviewed candidate. Finalization validates a candidate; it does not promote one.

Lifecycle transitions use the audited CLI and never the migration owner:

```bash
# Mapless/all-unassessed promotion or roll-forward; SQL still fails closed if evidence is required.
npm run release:lifecycle -- promote --release rel_...
npm run release:lifecycle -- roll-forward --release rel_...

# Reviewed-election proof: exactly 158 unique runs and the exact used lock-entry IDs.
npm run release:lifecycle -- promote --release rel_... \
  --election-source-release rel_... \
  --task9-run run_... --election-lock-entry lock_... # repeat exactly as required

# Emergency direct-predecessor rollback derives the current/predecessor under lock.
npm run release:lifecycle -- rollback
```

The process requires `INGEST_DATABASE_URL`, `RELEASE_PREFLIGHT_DATABASE_URL`, and `RELEASE_OPERATOR_DATABASE_URL`; the ingest connection performs no lifecycle mutation. Map-bearing transitions additionally require configured exact map storage, and reviewed elections require the verified source lock/raw store. Missing or incomplete proof arguments fail before transition.

For promotion, obtain a short-lived preflight proof through the authorized API while the candidate is locked, then consume it once through the authorized operator API. The proof is bound to target/predecessor and expires; an expired or consumed proof must fail. Direct-predecessor rollback has its defined proof-free path; roll-forward still uses the restricted API and applicable proof. On any conflict, expiry, stale digest, or failed smoke, leave the published pointer unchanged, disable further lifecycle attempts, and roll forward only after the root cause is corrected and a new valid proof is issued.

R2 publication remains externally blocked by real keyed/reviewed FEC evidence and mappings. R3 is blocked by reviewed nationwide election decisions and proof closure. R4 is blocked by a publishable R3 predecessor and production object-retention/runtime-credential evidence. These are not runnable local steps.

## Operational incidents and retention

Corrections remain disabled unless the trusted-edge/direct-ingress and cleanup evidence is approved. Disable correction intake immediately by removing `CORRECTION_INTAKE_ENABLED=true`; do not expose its CSRF or rate-HMAC secrets. Address lookup remains disabled unless `ADDRESS_LOOKUP_KILL_SWITCH=allow` plus the complete environment-specific privacy gate are approved; disable it immediately by removing that allow value or setting `ADDRESS_LOOKUP_MODE=disabled`. On address/correction privacy uncertainty, disable first, preserve only nonsensitive incident evidence, and follow [`address-lookup-privacy-gate.md`](../deployment/address-lookup-privacy-gate.md).

Operations owns retention for raw objects, source receipts, lifecycle proofs, operational tables, logs, backups, and vendor exports. Production maps additionally require version retention and delete denial. Do not claim telemetry delivery: signals are bounded, sanitized JSONL best-effort events with no default durable destination or retry. `releaseId`, `runId`, and `sourceId` are JSONL correlation fields only and MUST NOT be metric label dimensions.
