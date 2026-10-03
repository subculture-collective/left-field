# Recover the backed-up published release

Run the maintained factual restore script on NUC as root:

```sh
/usr/local/sbin/dsa-seats-factual-restore-drill.sh --snapshot-only
```

This is an isolated drill, not a production cutover. It retrieves the latest tagged encrypted backup, validates backup checksums and the archived source lock, matches the exact local application image ID, and restores temporary database and object volumes on an internal Docker network. Each disposable container has a one-CPU, 1536 MiB, 256-PID limit. The script removes its temporary containers, network, volumes and restored files when it exits.

The snapshot contract checks the backed-up release identity, seven stored content digests, ingest history, factual counts, web-role read/write restrictions, object-store TLS and retention, application routes, and restricted repository health. Repository health recomputes the existing seven-domain validation gate. The published pointer must remain equal to the backup's pointer. The health JSON is retained beside the text receipt in `/srv/server/restore-evidence/dsa-seats/`.

The snapshot result uses a separate `dsa_seats_snapshot_restore.prom` file and `dsa_seats_snapshot_restore_*` metrics. It never updates `dsa_seats_restore_drill_*`, which continues to represent the original restore-plus-publication-lifecycle contract. Failure to parse the health report, a failed repository gate, or a changed published pointer fails the snapshot drill.

Without arguments the script still runs the original rollback/roll-forward exercise. That exercise currently rejects the August full release: it selects the legacy publication path, but the required predecessor proofs and unchanged-content inheritance do not exist. A successful snapshot drill does not qualify release promotion, rollback followed by roll-forward, production telemetry, or a production cutover. Do not invent proof records or weaken those publication checks to make that exercise pass.

Prerequisites include the current restic password file, trusted SSH host key, NUC backup key, exact application/PostGIS/MinIO server images, the pinned MinIO client, and retained FEC TLS material. The client archive is on Dozor at `/srv/recovery/images/minio-mc-a7fe349ef4bd.tar.zst`; verify SHA256 `682a8948ad1dd6c69496573f68592add9ec3a87fd18caed72ef5b2291690f8f2` before loading it. Verify loaded client image ID `sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727`. This drill does not prove reconstruction on a blank host without those prerequisites.

Environment overrides for repository, key, evidence directory, metrics destination and restore subnet remain available. Keep snapshot and lifecycle metric destinations separate. Unknown or extra command-line arguments are rejected before any restore work begins.
