# New Hampshire rapid House-primary result — 2026-08-08

This slice retains the two 2024 Democratic congressional district workbooks linked by the New Hampshire Secretary of State. The live state file host returned HTTP 403 to repeatable automated retrieval, so the source lock records deterministic Internet Archive captures of the exact official file URLs. That boundary is preserved as `archived_copy_of_official_secretary_workbook_retained_live_host_403_not_claimed_certified`; the archive is transport, not a substitute certification authority.

The parser validates each XLSX container, exact sheet/title/date/header layout, literal town-level vote cells, formula-bearing cached totals, and exact arithmetic closure. NH-01 contains Chris Pappas 54,927 and Kevin Rondeau 2,783 (57,710 Democratic candidate votes across 109 reporting-unit rows). NH-02 contains Maggie Goodlander 42,960 and Colin Van Ostern 24,342 (67,302 across 211 rows). Combined closure is two contests, four candidate rows, and 125,012 candidate votes.

The templates also contain Republican-labeled columns; those are not treated as Democratic-primary candidates. Neither workbook exposes a winner marker. Winner, identity, certification, evaluator, and score fields remain null or false.

Pins:

- NH-01 workbook: 28,223 bytes; SHA-256 `79713159348e24389f2e115f0cc77bc3acd016b6ea2a90e1366e6a8166a55593`.
- NH-02 workbook: 37,838 bytes; SHA-256 `1f6dfb3b1d759f89845f5947add0b4cd8867ad2da442e2f501046f796809ec92`.
- Result artifact: 2,654 bytes; file SHA-256 `e8ea507bcbb2f913edd2e9b59db21f238b092f278f4d7367fe6c1f163d0aa337`; package `9109b6c1dad880ceb22a852b4e73d4e0c2738ca2d9d6eb6a006ca286c3b140f9`; result set `13911ed6817823916202a0a73beab1f2f89ca0da01b42edc190c6b9d4b688254`.
- Projection v13: 61,795 bytes; file SHA-256 `c0905550dfa3b05e1b43b462924fc2e0f828512eb7de6aae64f84925ac291dc5`; package `310b11c9964eb4f86533f6a7d7d456081c0bd4236df4bcfbfbe879fd994fb7d7`.
- Ledger v13: 20,077 bytes; file SHA-256 `5e10a98949f3e8cc25d002aca6e2bddef6cda3d462c5b17f27f998ea5460a315`; package `12f3273edddf38dfc55939217964ef0f2da76197f3eed291d77a14131639d24f`.

Reproduction:

```sh
npm run acquire:rapid-house-primary-new-hampshire-2024
npm run generate:rapid-house-primary-new-hampshire-results
npm run generate:rapid-house-primary-projection-v13
```
