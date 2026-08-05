# AIPAC source receipt package — 2026-08-04

Status: **acquired and byte-verified; not yet eligible for a complete-coverage claim**

The machine-readable package is `data/metadata/aipac-source-receipts-v1.json`. It records six official FEC downloads covering the 2022, 2024, and 2026 cycles, their exact URLs, sizes, SHA-256 digests, retrieval times, and observed committee-row counts.

## Package origin

- Direct-contribution candidates come from the FEC's PAS2 “contributions from committees to candidates” archives. The retained committee of interest is AIPAC PAC, `C00797670`.
- Independent-expenditure reconciliation rows come from the FEC's cycle-specific independent-expenditure CSV files. The retained spender of interest is United Democracy Project, `C00799031`.
- United Democracy Project's network classification is a separate, versioned classification input. The FEC committee ID establishes the filer; it does not by itself establish organizational affiliation.

The receipt verifier reads each exact local object with no-follow file semantics, rechecks inode and byte size, recomputes SHA-256, and never opens ZIP members or retains raw person/name/address fields.

## Acquired evidence

| Cycle | AIPAC PAC PAS2 rows | Primary-coded PAS2 rows | PAS2 filing numbers | UDP bulk IE rows |
|---:|---:|---:|---:|---:|
| 2022 | 943 | 468 | 11 | 199 |
| 2024 | 6,535 | 4,107 | 24 | 267 |
| 2026 | 1,092 | 997 | 17 | 145 |
| **Total** | **8,570** | **5,572** | **52 cycle-local observations** | **611** |

These are source observations, not final evidence totals. Amendments, reversals, recipient mappings, primary-election context, and the release cutoff still have to be resolved.

## Why coverage remains false

PAS2 does not carry filing receipt dates or predecessor links. Its rows must be joined to a cutoff-valid FEC filing ledger before a post-cutoff amendment can be excluded. The bulk independent-expenditure CSV is useful reconciliation evidence, but it does not establish complete Form 3X Schedule E acquisition. Therefore all six receipts deliberately carry `coverageClaim: false`.

The next eligibility gate requires:

1. a terminal OpenFEC filing enumeration for AIPAC PAC and United Democracy Project through the declared cutoff;
2. cutoff-valid filing/amendment-chain resolution, including Form 3X and Form 24 Schedule E;
3. a reviewed candidate/seat/authorized-committee mapping package with effective cycles and artifact hashes;
4. a versioned primary-source classification package for the AIPAC/UDP relationship;
5. an independently replayed sanitized artifact whose digest and record closure match the declared evaluation run.

Until those checks pass, the application must render this channel as `Unavailable — not collected`, even when a downloaded row appears to show support.
