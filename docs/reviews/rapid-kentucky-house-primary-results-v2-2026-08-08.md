# Kentucky rapid House-primary results v2 — 2026-08-08

This update closes the 2022 KY-03 Democratic primary from the Kentucky State Board of Elections' statewide primary-results PDF. The retained table records Morgan McGARVEY 52,157 and Attica SCOTT 30,183, exactly matching the printed totals (82,340 votes). It composes with the existing 2024 KY-03 result for two observations, five candidate rows, and 134,981 votes.

The PDF is an official result publication, but the retained bytes contain no source winner marker and no separate certification instrument is bound. Winner, identity, evaluator, and score fields remain null or false. Poppler reports repeated malformed flate blocks while still deterministically producing the pinned complete text projection; both the raw PDF and exact derived text are retained.

Pins:

- 2022 PDF: 221,391 bytes; SHA-256 `385848ad3fd60c221d299cc8d75abc7bb646c96fdfa8e3ab21327590aaff0253`.
- Layout text: 103,147 bytes; SHA-256 `57bba153f9be1e67678759eeb69ec9b9d21f46796c8afe9ca3d23128d3f83590`.
- Kentucky v2: 2,129 bytes; file SHA-256 `c337583414a47486496104238f55febf36f236600daae035d2c4cacf26247392`; package `878c831d8734fffa9c518fffb72f97a1dceb2a85013d2d6897c4279b76696fc4`; result set `c62c570e208a74873b5111ec5792a8f6d4d0f28fc0b4eae8b0205f13a44add29`.
- Projection v14: 61,969 bytes; file SHA-256 `39ebdda4788192bf544fabc92b3004b74f9ac3ea5437ec1c5501f989a8081a52`; package `b327d0f123c2f18cc014739eed82519f18b76c6415a4c469b96ec3aadd0c31b5`.
- Ledger v14: 20,071 bytes; file SHA-256 `69bd8a516d37c81136b3f02000f0b19b0596f6d67611717337f0af8c1d35003c`; package `562b0ed3921f951a9218a29a40bc121fa3fed04575a99b2faf25c40746e17c2f`.

Reproduce with `npm run acquire:rapid-house-primary-kentucky-2022`, `npm run generate:rapid-house-primary-kentucky-results-v2`, and `npm run generate:rapid-house-primary-projection-v14`.
