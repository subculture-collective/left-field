# Connecticut primary geography authority — 2026-08-06

The repository now retains the official Census TIGER/Line 2022 Connecticut 118th-Congress district bundle needed for 2022 historical-key compatibility review. The ZIP is 458,752 bytes with SHA-256 `8d0a25a21e2536884c4f42603d167d13fc729be1944ae37499f3a0fd12b9b254`.

Its seven-member archive contains the expected `tl_2022_09_cd118` shapefile family. The 1,090-byte DBF has exactly six records: numbered districts `01`–`05` plus Census sentinel `ZZ`; all records identify state FIPS `09` and Congress session `118`. The sentinel is retained as source evidence but is not a congressional seat.

This source establishes a complete official district-key inventory, not geometric equality, plan continuity, candidate identity, nomination status, review approval, or evaluator eligibility. The already retained 2025/CD119 Connecticut TIGER source is a separate current-session parent. A later geography candidate must bind the source-selection proposal, the nomination-authority observations, the Census CD119 redraw-scope authority, and both exact DBF inventories before proposing compatibility.

```bash
npm run fetch:ct-primary-geography-authority
npx vitest run scripts/fetch-connecticut-primary-geography-authority.test.ts
npm run data:verify
```
