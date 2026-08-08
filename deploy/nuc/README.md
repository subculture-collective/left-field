# NUC deployments

`compose.yml` is the disposable synthetic Task 10 preview. It is not a factual
data deployment and its `seed` profile must never initialize a public factual
release.

`factual.compose.yml` is the isolated factual R1 stack. It uses a different
Compose project, database, raw-object volume, map volume, credentials, image
tag, and NUC port (`3045`). The existing synthetic preview on `3044` is retained
only for isolated forensic comparison. It must never be restored to the public
route.

## Factual R1 safety contract

1. Build an image from an exact source snapshot and record the source-tree
   SHA-256 and image digest.
2. Create `deploy/nuc/secrets/` as mode `0700`. Every file must be mode `0600`;
   database and object-store passwords are independently generated hexadecimal
   values. Never copy the preview `.env`.
3. Set only identifiers and hashes in an untracked factual environment file.
4. Start the factual stack without changing Caddy:

   ```bash
   docker compose --env-file deploy/nuc/factual.env \
     -f deploy/nuc/factual.compose.yml up -d
   ```

5. Use the `release` tools profile to create, ingest, finalize, inspect, and
   promote `rel_r1_20260718`:

   ```bash
   docker compose --env-file deploy/nuc/factual.env \
     -f deploy/nuc/factual.compose.yml run --rm release \
     npm run bootstrap:factual-r1 -- \
       --release rel_r1_20260718 \
       --label "Factual R1 2026-07-18" \
       --cutoff 2026-07-18
   ```

   Then run the documented identity and TIGER ingestion commands with the
   constrained ingest login and retain their run IDs. Nationwide finalization
   computes the complete seven-domain manifest and must use only the dedicated
   `NATIONWIDE_FINALIZER_DATABASE_URL` injected from
   `db_nationwide_finalizer_password`; never replace it with the migration-owner
   connection or broaden the ingest login's grants. Require
   `release:health -- --release rel_r1_20260718` to report
   `repositoryStatus: "pass"`, and promote only through `release:lifecycle`.

   Production FEC v2 tooling similarly receives distinct
   `FEC_V2_ACQUISITION_DATABASE_URL` and
   `FEC_V2_REPLAY_VERIFIER_DATABASE_URL` connections plus
   `FEC_API_CREDENTIAL` from mounted files. Those machine credentials do not
   authorize a run by themselves: acquisition still requires the exact sealed
   541-seat plan, verifier-owned expectation, fixed cutoff, and configured
   versioned TLS object store with retained operator evidence. Mount the
   immutable evidence file and the store's public root CA into the release
   container. The release tooling recomputes the evidence hash and requires it
   to match the configured endpoint, bucket, pinned CA, enabled versioning,
   writer delete denial, exact one-year COMPLIANCE default retention, and a
   retained-object proof. The public application receives none of the FEC
   secrets.

6. Before cutover, verify the database has one published factual release, no
   release/source label containing `Synthetic`, 541 seats, 497 valid
   geometries, 537 memberships, four explicit vacancies, seven current content
   digests, and no unresolved ingestion run. Verify the web login cannot write.
7. Verify `http://10.0.0.56:3045/` and a browser render from Almaz. Only then
   change the Almaz Caddy upstream from `3044` to `3045`, validate Caddy, reload
   gracefully, and verify public HTTP and HTTPS bodies plus application assets.

8. Register `deploy/nuc/dsa-seats-alerts.yml` in the active Prometheus
   configuration with `deploy/nuc/register-prometheus-rules.sh`, restart the
   Prometheus container so its file bind mount sees the atomic replacement, and
   require all 17 `dsa-seats-factual` rules to be healthy and inactive.

If factual R1 becomes unavailable and cannot be recovered in place, switch the
public route to `seats-maintenance.Caddyfile` and return an explicit HTTP 503.
Do not point public traffic at `10.0.0.56:3044`: serving synthetic records under
the factual hostname is not an acceptable rollback. A future data rollback must
target a separately verified prior factual release.

The encrypted backup includes the immutable FEC retention evidence and public
root CA, but never the FEC server private key. The restore drill therefore
requires the approved external TLS-secret recovery path. It starts the restored
store over HTTPS, validates it with the backed-up CA, checks the recorded CA and
server-certificate bindings, and proves the exact one-year COMPLIANCE default
plus a versioned retained object. A successful data restore without those TLS
and retention checks is not sufficient activation evidence.
