# ACS indicator dictionary

This release is **display-only and non-ranking**. It publishes only direct-source 2024 ACS 5-year table-based summary-file values, with the Census-published **90% confidence interval** MOEs; it derives no indicators.

Census sentinel values remain explicit missing facts. In particular, a controlled MOE (`-555555555`, statistical testing is inappropriate) is published as `not_applicable`, never as a numeric zero-width interval.

| Indicator | table columns | unit | universe |
| --- | --- | --- | --- |
| Total population | `B01003_E001` / `B01003_M001` | count | total population |
| Median age | `B01002_E001` / `B01002_M001` | years | total population |
| Median household income | `B19013_E001` / `B19013_M001` | USD | households |

Age bands, education, race/ethnicity, tenure, and urbanicity are not in this release. In particular, this release makes no urbanicity ACS claim.
