# Phase 1 correction intake engineering evidence

## Milestone

Task 11 is implemented as an operational correction workflow outside immutable release content. Public intake remains disabled by default. Enabling it requires deployment evidence that a trusted edge overwrites the configured client-IP header and direct ingress cannot bypass that edge.

## Boundary

- Migration `0004_large_johnny_storm.sql` creates an isolated `operations` schema with immutable submissions, append-only review events, short-lived idempotency keys, and distributed rate buckets.
- Correction tables are absent from release manifests, content digests, candidate baselines, and release preflight fingerprints.
- Dedicated intake, reviewer, and maintenance roles can execute only their fixed `SECURITY DEFINER` APIs and have no direct table or release-content mutation access.
- Reviewers have a host-only, redacted-by-default CLI documented in
  [`correction-review-runbook.md`](../operations/correction-review-runbook.md).
  It requires the distinct `CORRECTION_REVIEWER_DATABASE_URL`, never exposes a
  public reviewer route, rejects redirected sensitive output, and records only
  optimistic append-only transitions. Migration
  `0015_correction_reviewer_exclusivity.sql` rejects mixed membership with any
  other `dsa_seats_*` capability, including later address and FEC roles.
- Intake is one same-origin JSON route with bounded streaming, CSRF, server-generated idempotency, canonical trusted-IP hashing, sanitized no-store responses, and no request logging.
- The accessible form collects only release/seat identifiers, an allowlisted field, explanation, and optional public HTTPS evidence URL. It warns against personal information and private links.

## PostgreSQL evidence

A fresh disposable PostgreSQL database applied migrations `0000` through `0004`. The guarded Task 11 scenario passed using distinct intake, reviewer, maintenance, and web LOGIN principals. It proves concurrent idempotency, mismatch conflict, replayable unavailable targets, 100/minute global cardinality, five/hour subject limits without consuming excess global quota, a separate 20/minute pre-parse attempt throttle, stable reviewer pagination, exclusive role membership across all runtime roles, append-only review transitions, candidate/snapshot incorporation binding, cleanup, raw-input application/database URL-validation parity, and unchanged manifest/gate/seven-domain digests.

## Browser evidence

With `E2E_MAP_PROFILE_PATH=/seats/seat_0` against the disposable published-map fixture, desktop Chromium and Pixel 5 Chromium passed all 12 correction-flow checks. These cover the profile correction link, exact release/seat-only prefill, form validation, safe request shape, distinct malformed/conflict/rate/unavailable messaging, terminal success/replay behavior, focus handling, zero console errors, and Axe WCAG A/AA.

Focused validation passed 52 correction/schema tests, strict TypeScript, ESLint with zero errors, and 68-table Drizzle no-drift generation.

The final clean gate applied migrations `0000`–`0004`, passed all 33 guarded PostgreSQL scenarios in about 691 seconds, and passed 465 non-guarded tests across 61 files (the same 33 guarded cases were skipped only in the non-database command). TypeScript, ESLint, the Next production build, 94-entry source lock, zero-vulnerability npm audit, Compose validation, Drizzle no-drift, and diff checks passed.

## Publication status

Correction reports never mutate the cited release. An accepted report may only be associated with a later candidate through the controlled reviewer state machine. Public POST enablement remains blocked until trusted-edge header overwrite, direct-ingress exclusion, and operational cleanup deployment evidence are approved.

## 2026-08-08 reviewer follow-up

Migration `0015` and the host-only reviewer CLI were exercised against a fresh
disposable PostGIS database through the real Task 11 principal scenario. The
scenario passed mixed reviewer/address and reviewer/FEC rejection, stable queue
reads, optimistic conflicts, the full append-only transition chain, candidate
lineage, and approved-snapshot incorporation. CLI tests additionally cover all
allowed transition edges, evidence arity, cursor pairing, redacted output, and
TTY-only sensitive display. This follow-up makes review executable but does not
activate public correction intake or satisfy its separate external gates.
