# Address lookup privacy gate

Status: **BLOCKED — shared lookup must remain disabled**

This checklist is a release gate, not evidence that the controls already exist. The current prototype exposes no address form or lookup route. Do not add or enable one in a shared environment until every item below has an owner, review date, configuration evidence, and approval.

## Approval record

| Field | Required value |
| --- | --- |
| Environment | Exact deployment name and region |
| Product owner | Named approver |
| Security owner | Named approver |
| Operations owner | Named approver |
| Review date | ISO date |
| Configuration evidence | Immutable links or exported redacted configuration |
| Kill-switch exercise | Timestamp and result |

Two-person approval from the security and operations owners is required. Approval applies only to the recorded environment and configuration revision.

## Request boundary

- [ ] The product accepts lookup submissions only in a `POST` body; URLs, query strings, route parameters, headers, and client telemetry never contain the address.
- [ ] Request and response caching is disabled (`Cache-Control: no-store`) at the application, proxy, CDN, and browser layers.
- [ ] Request-body logging and support capture are disabled before the request reaches application code.
- [ ] Client disconnects propagate an abort signal through Census and PostgreSQL work.
- [ ] Database pool acquisition, statements, and cancellation are bounded; aborted work cannot linger or cancel a reused connection.
- [ ] A production allowlist and startup assertion keep lookup disabled by default. A tested kill switch disables it without a deploy.

## Address and coordinate telemetry

The Census single-record API necessarily transmits the address in an outbound HTTPS query string. PostGIS lookup necessarily sends exact coordinates as database bind values. Code-level output sanitization does not protect either path from infrastructure telemetry.

- [ ] Application logs, exception reports, and support exports drop request bodies, full outbound URLs, normalized addresses, matched addresses, and coordinates before ingestion.
- [ ] Reverse proxy, CDN, WAF, load balancer, service mesh, egress proxy, DNS/HTTP diagnostics, and hosting logs do not retain those values.
- [ ] APM, distributed tracing, auto-instrumentation, profiling, session replay, analytics, tag managers, and browser error reporting are absent from the lookup page or demonstrably redact those values before capture.
- [ ] PostgreSQL statement, bind-parameter, error, cancellation, slow-query, audit-extension, `auto_explain`, query-insights, and database APM telemetry do not record coordinates.
- [ ] Backups, archives, dead-letter stores, data lakes, and vendor support snapshots inherit the same exclusions and bounded retention.

## Census processor disclosure

- [ ] Pre-submission copy clearly states that the address is sent to the U.S. Census Bureau in a request URL for geocoding.
- [ ] The disclosure links the applicable Census privacy/retention material and does not claim that Census never retains requests unless verified contractually.
- [ ] Vendor review records the exact allowed HTTPS origin/path, redirect rejection, expected benchmark/vintage, and review date.

## Abuse controls and retention

- [ ] Shared rate limiting works across all instances without retaining raw addresses.
- [ ] If IP-derived identifiers are used, their derivation, key rotation, access, TTL, deletion, log retention, and backup expiry are documented and approved.
- [ ] Logs cannot associate IP/timestamp identifiers with returned seat IDs or other political-interest records beyond the minimum approved operational window.
- [ ] Retention limits are tested against primary stores, replicas, archives, backups, vendor systems, and support exports.

## Canary procedure

1. Use a unique, non-residential, non-personal marker address approved for testing. Record the exact coordinates returned during the controlled run.
2. Exercise success, no-match, upstream error, database error, timeout, caller-abort, rate-limit, disabled, and kill-switch paths.
3. Search every internal and vendor log, trace, replay, analytics store, error event, database telemetry surface, archive, backup index, and support export for both the marker and coordinates.
4. Repeat the search after every documented retention and backup-expiry boundary.
5. Any occurrence outside the expected Census transmission fails the gate. Disable lookup immediately, preserve only non-sensitive incident evidence, and repeat review after remediation.

## Current prototype decision

No deployment configuration evidence or shared lookup route is checked in. The `/lookup` page must therefore remain informational and must not collect an address.
