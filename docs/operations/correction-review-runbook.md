# Correction reviewer operations

The correction reviewer is a host-only CLI. It is not a Next.js route and it
does not mutate a published release. PostgreSQL appends every successful state
transition through `operations.transition_correction_v1`; optimistic sequence
and status fields prevent a stale reviewer action from overwriting newer work.

## Connection boundary

Inject `CORRECTION_REVIEWER_DATABASE_URL` through the approved secret-loading
path. Its LOGIN principal must belong exclusively to
`dsa_seats_correction_reviewer`. The public intake connection
`CORRECTION_DATABASE_URL`, web connection, migration owner, and release operator
are intentionally rejected substitutes. Never place a database URL on the
command line or in shell history.

Migration `0015_correction_reviewer_exclusivity.sql` also rejects a reviewer
LOGIN that inherits any other `dsa_seats_*` capability, including address and
FEC roles added after the original correction schema.

Production provisions that principal from the independently generated
`db_correction_reviewer_password` secret. Run the CLI only through the isolated
Compose tool service, which mounts that one database secret and neither the
migration-owner nor release-operator credentials:

```bash
docker compose -p dsa-seats-r1 \
  --env-file /srv/apps/projects/dsa-seats-r1/runtime/factual.env \
  -f deploy/nuc/factual.compose.yml run --rm correction-reviewer \
  npm run corrections:review -- list --limit 50
```

Create the secret once with a cryptographically random value, mode `0600`, in
the factual `SECRETS_DIR`; then rerun `role-grants` so the dedicated login is
created or rotated. Do not copy any existing database password.

## List the queue

```bash
npm run corrections:review -- list --limit 50
```

The bare npm examples in the sections below are for a controlled development
shell with `CORRECTION_REVIEWER_DATABASE_URL` already injected. On the NUC,
replace them with the isolated Compose invocation above and pass the same CLI
arguments after `npm run corrections:review --`.

The default JSON output includes identifiers, field path, time, status,
sequence, and booleans indicating whether content exists. It omits the submitted
explanation and evidence URL so routine logs remain payload-free. A reviewer may
use `--include-content` in a controlled terminal when the submitted evidence is
needed. The CLI rejects that flag unless stdout is an interactive TTY, so it
cannot be redirected into an ordinary log or file.

Pagination is stable and requires both cursor values:

```bash
npm run corrections:review -- list --limit 50 \
  --after-time 2026-08-08T12:00:00.000Z \
  --after-id 11111111-1111-4111-8111-111111111111
```

## Record a review transition

Every mutation requires the correction UUID plus the status and sequence just
observed. For example, triage a submitted report:

```bash
npm run corrections:review -- transition \
  --id 11111111-1111-4111-8111-111111111111 \
  --expected-sequence 1 \
  --expected-status submitted \
  --to-status in_review \
  --reason triaged
```

The CLI permits only the transition graph enforced by PostgreSQL. Queueing an
accepted correction additionally requires `--candidate-release`; incorporation
requires both that same candidate release and `--approved-snapshot`. A
`conflict` result means the queue changed after it was read and must be listed
again. `invalid_transition` is not an approval and must not be retried by
changing evidence identifiers speculatively.

Public correction intake remains disabled until the separately documented
signed activation, edge, retention, cleanup, backup-expiry, and two-person
review requirements are satisfied. This CLI makes review executable; it does
not claim those activation requirements have passed.

## Clean expired intake controls

Expired idempotency keys and rate-limit buckets are deleted only through
`operations.cleanup_correction_controls_v1()`. The maintenance command uses a
separate LOGIN that belongs exclusively to `dsa_seats_correction_maintenance`;
it cannot list submissions, review content, transition corrections, or use the
public intake connection.

Create an independent `db_correction_maintenance_password` in the factual
`SECRETS_DIR`, mode `0600`, then rerun `role-grants`. A manual bounded run is:

```bash
docker compose -p dsa-seats-r1 \
  --env-file /srv/apps/projects/dsa-seats-r1/runtime/factual.env \
  -f deploy/nuc/factual.compose.yml run --rm correction-maintenance
```

The command emits only the two nonnegative deletion counts. It never emits a
correction identifier or submitted content. Production scheduling uses
`dsa-seats-correction-maintenance.timer`; install the service, timer, and
`run-correction-maintenance.sh` from the exact deployed release, then enable the
timer. The runner derives the release directory from the exact 64-character
`APP_IMAGE` tag in the factual environment and fails closed if that release or
compose file is absent.

```bash
sudo install -m 0755 deploy/nuc/run-correction-maintenance.sh \
  /usr/local/sbin/dsa-seats-correction-maintenance.sh
sudo install -m 0644 deploy/nuc/dsa-seats-correction-maintenance.service \
  deploy/nuc/dsa-seats-correction-maintenance.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dsa-seats-correction-maintenance.timer
sudo systemctl start dsa-seats-correction-maintenance.service
sudo systemctl status dsa-seats-correction-maintenance.service \
  dsa-seats-correction-maintenance.timer
```

The timer is operational plumbing, not correction-intake approval. Keep intake
disabled until the independent retention, backup-expiry, privacy, edge, and
two-person activation evidence is complete.
