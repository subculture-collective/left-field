# Nevada rapid House-primary result receipt

This slice retains deterministic Internet Archive captures of the Nevada Secretary of State pages titled “Official Statewide Primary Election Results” for June 14, 2022 and June 11, 2024. The live Nevada host blocks unattended retrieval through Incapsula; the archive captures preserve the original official page content and are labeled `archived_official_source` rather than direct live downloads.

The six current-target observations close exactly:

- 2022 NV-01: Dina Titus 33,565; Amy Vilela 8,482; total 42,047.
- 2022 NV-03: Randell “Randy” Hynes 4,265; Susie Lee 37,069; total 41,334.
- 2022 NV-04: no Democratic contest table appears in the complete official statewide page.
- 2024 NV-01: no Democratic contest table appears in the complete official statewide page.
- 2024 NV-03: Rockathena Brittain 3,036; Susie Lee 33,901; total 36,937.
- 2024 NV-04: Steven Horsford 34,861; Levy Shultz 4,084; total 38,945.

The two absent tables are source-absence observations only. They are not converted into zero votes, no primary, uncontested nomination, winner, or incumbent identity. The pages do not expose a machine-readable winner marker used by this parser, so vote rank is not converted into a winner. No separate certification instrument is claimed beyond the source pages' own “Official” label. All six observations remain identity-null and score-ineligible; Nevada 2026 remains source-blocked.

Pinned outputs:

- Nevada result package: 6,083 bytes; SHA-256 `f2a4927dbdb7967951e1769f04a2689af70ccd16e1520115314261236eebd3e6`; package `8be9088e767df172c29906516e35cf3b1f0340ad8a570814222ae385480b8f22`; observation set `4465d41acad1b4784d2500375db2c9902f512066d1d63804c8bd232b0c890d15`.
- Rapid projection v25: 65,948 bytes; SHA-256 `ad68a7db06677e258aa8062801f91884a8357703003fb23abd594048d46c32ff`; package `0257bfbccf5645190243ba7711477e69113cf14ccfee12772c3da2f9e4bd51b1`.
- Coverage ledger v25: 20,443 bytes; SHA-256 `0dc2a19d1e44ab452d304769def5e804bd0ccbb90a35987d8d3319b75624d7ed`; package `6670713a782ef1c68f1693e1f358a9b277e04765f10459061a60e1aa53c40da3`.

Reproduction:

```sh
npm run acquire:rapid-house-primary-nevada
npm run generate:rapid-house-primary-nevada-results
npm run generate:rapid-house-primary-projection-v25
npx vitest run src/rapid-acquisition/house-primary-nevada-results.test.ts src/rapid-acquisition/house-primary-projection-v25.test.ts src/ui/rapid-house-primary-coverage.test.ts
```
