# CA-31 cutoff-bounded FEC chain receipt — 2026-08-05

## Outcome

Official FEC records mechanically establish the 2024 person/seat/cycle/committee relationship between Gilbert Cisneros's CA-31 candidacy and `C00850420` (Cisneros for Congress). The relationship is closed as evidence, not approved by a reviewer. The official cross-surface candidate-ID discrepancy remains unresolved and explicit: OpenFEC indexes the statements under roster ID `H8CA39174`, while the signed Form 2 PDFs print `H4CA31170`. This receipt does not resolve the identifier mapping or claim the IDs are equal.

The cycle-relevant evidence is the September 12, 2023 pair:

- the new Form 2 for election year 2024 names Cisneros for Congress as the principal committee, House CA-31;
- the same-day new Form 1 registers Cisneros for Congress as committee `C00850420`;
- the only Form 1 amendment, filed September 10, 2024, retains `C00850420`, the same committee name, candidate, office, state, and district;
- the November 15, 2024 Form 2 is a new statement for election year 2026, not retroactive proof of the 2024 cycle.

The cutoff-bounded API enumeration is exhaustive for the exact queried surfaces: `H8CA39174` Form 2 has seven results on page 1 and an empty terminal page 2; `H4CA31170` has zero results on pages 1 and 2; `C00850420` Form 1 has two results on page 1 and an empty terminal page 2. No later Form 1 for `C00850420`, or Form 2 in the queried `H8`/`H4` indexes, appears through August 4, 2026. This is not a universal claim about every possible FEC identity surface.

## Integrity and privacy

The six raw API responses and four PDFs are nonretained. Their exact URLs, byte sizes, and SHA-256 hashes are source-locked; only identifiers, dates, form/amendment facts, pagination, relationship facts, and hashes are retained. The receipt contains no donor records, addresses, employer/occupation fields, filing free text, reviewer identity, or approval timestamp.

The automatic closure is:

`aipac-mapping-precedence:incumbent:seat_house_ca_31_current:2024:H8CA39174`

It retains `H8CA39174` as the pre-existing roster/OpenFEC index ID and records `H4CA31170` as the signed-form value. The cross-surface identifier conflict remains unresolved; only the person/seat/cycle/committee relationship is mechanically closed.

## Reproduction

```bash
npm run generate:ca31-terminal-chain
npm run generate:aipac-incumbent-resolution-v3
npm run generate:aipac-evidence-foundation-v4
npm run test:run -- \
  src/ingestion/fec/ca31-terminal-chain-receipt.test.ts \
  src/ingestion/fec/aipac-incumbent-resolution-dispositions-v3.test.ts \
  src/ingestion/fec/aipac-evidence-foundation-candidate-v4.test.ts
npm run data:verify
```

Artifacts:

- `data/metadata/ca31-terminal-fec-chain-receipt-v1.json`: artifact `1c3d46fcfc76a33ed1fca469cbefb9924622a2245f266fc6394850845c9b7198`, evidence set `539ed96bbfa5e6058d5a3f9085b9d3d804616c3615c9613b265f6952228fe3c8`, package `8201a54aa4894163bda0a24b214c10166ade3fe4fcbe31b6e0667d7094b11cee`.
- `data/metadata/aipac-incumbent-resolution-dispositions-v3.json`: artifact `a4cb0f8e8f7ac43307533c0c08e8f440d83ab7d71574bbbde946ad2ca6b3a973`, package `a197a79bec4adab061f407f18d2cca2aa1b5783c18b2c343f4d91138915daab6`.
- `data/metadata/aipac-evidence-foundation-candidate-v4.json`: artifact `172095d17f0362e8f4da56ce4702727215b73c03362a22f0ae3270d1ebe95cc6`, package `657feef821124ecd4bd1af66784787652e2513a37401cb75d739fcfdf78ebb94`.

All three artifacts remain reviewer-only and nonpublishable. Six incumbent cases are fully resolved, ten House-cycle relationships are usable, two office-change cycles remain not applicable, and zero mapping decisions remain.
