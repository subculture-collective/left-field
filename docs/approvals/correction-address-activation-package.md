# Correction and Address Activation Package

This is a **BLOCKED** template, not an approval or activation claim. The verifier accepts only a canonical, two-signature package bound to its exact environment, canonical public domain, deployment ID/revision, build SHA-256, migrations through `0007`, feature configuration, shared retention policy, and individual evidence hashes. Security and operations signatures must be detached, valid, distinct approved keys.

All missing applicable attachments are **BLOCKED**. The application cannot enable either feature from environment variables; only the root-owned gate file can do so. The gate is root:`dsa-seats-gates`, `0640`, delivered through a safe parent/read-only mount, and a kill writes disabled state.

## Package separation

- `correction-activate` binds correction lifecycle, moderation, redaction/deletion, restore, and cleanup evidence. It explicitly excludes Census, egress, canary plans, vectors, and results.
- `address-canary` binds Census/vendor disposition, egress policy, host/log/APM inventory, backup evidence, canary plan, and vector hashes. It contains **no canary results** and expires within 15 minutes.
- `address-enable` binds the prior signed canary results plus 14-day log and 30-day backup/archive expiry-search evidence.

Each package uses `config/dsa-seats/correction-address-activation.schema.json`. A completed example, unsigned file, or stale/expired package remains disabled.
