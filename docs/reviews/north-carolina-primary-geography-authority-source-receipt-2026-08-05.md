# North Carolina primary geography authority source receipt

Status: **exact official source acquisition; no geography relationship, approval, evaluator value, publication, or deployment**

The North Carolina General Assembly's redistricting authority page, exact plan shapefiles, and NCGA block-assignment files keyed to 2020 Census tabulation blocks are retained for the three primary cycles in the North Carolina reviewer package:

| Primary cycle | Official plan statement | Exact retained plan | Shapefile SHA-256 | Block assignment SHA-256 |
| --- | --- | --- | --- | --- |
| 2022 | Court-ordered 2022 plan, used for the 2022 election | `Interim Congressional`, 14 districts | `60455cbbf7f75196441f01d38720f27b8b7766b512e889543a17dc54feba3ae5` | `95b0e6c0bca9bd18932195649fa23406c28b35f975aab9815c64c3d06cf74b4a` |
| 2024 | 2023 plan enacted as Session Law 2023-145, used for the 2024 election | `SL 2023-145`, 14 districts | `08356ab4db690e8dea60eba42f6b8490e24cd2b711cbde507d1b33f138cf9da5` | `9ff24ce1565750e8677c0c4d5d27f5b6c0f28ccc78b1ad93c53c4565c4d35dfe` |
| 2026 | 2025 plan enacted as Session Law 2025-95, used for the 2026 elections | `SL 2025-95`, 14 districts | `c21e18d29a0f6dd52636c866ca3b05295a0757c6d6d98ee42ffa0b2eee795897` | `f8fc2a273ed86482bd3aec400868f2a47ce91eaab42dd74d3509fc022daf4721` |

The separately retained General Assembly page has SHA-256 `8f11ae03c95c6e19e75cef133390c5e1176dc71d7253f72345fbd480504eb001`. The fetcher binds all seven sources one-to-one to the source lock, validates the page's plan-to-election statements, proves each DBF contains districts 1 through 14, and validates 236,638 unique 15-digit block identifiers, districts 1 through 14, and an identical block universe across all three assignments.

The block assignments allow deterministic comparison on common 2020 Census tabulation-block identifiers. They prevent two unsafe shortcuts: a repeated district number across 2022 and 2024 does not establish unchanged geography, and the 2026 primary must use North Carolina's specific 2025 enacted plan rather than a generic or unavailable `CD120` placeholder. A block-level comparison to the current CD119 target plan remains required before historical or 2026 contest geography can be proposed.

Reproduce and verify with:

```sh
npm run fetch:nc-primary-geography-authority
npm run data:verify
```

No plan relationship is approved or score-eligible merely because its source bytes are retained.
