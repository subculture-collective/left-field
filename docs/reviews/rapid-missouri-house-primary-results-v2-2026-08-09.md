# Rapid Missouri House primary results v2

This v2 rapid receipt adds the two 2022 target Democratic congressional primary observations to the retained 2024 Missouri package. The retained PDF is a deterministic Internet Archive capture of the exact Missouri Secretary of State official-results URL; the archive is transport, not an added certification authority.

The source table closes MO-01 at 94,018 Democratic votes across Ron Harshaw (1,065), Michael Daniels (1,683), Cori Bush (65,326), Earl Childress (929), and Steve Roberts (25,015). It closes MO-05 at 70,546 across Emanuel Cleaver II (60,399) and Maite Salazar (10,147). The separate source totals of 110,574 and 110,689 include other parties and are deliberately excluded from the Democratic denominators.

The PDF says `OFFICIAL RESULTS` and identifies the August 2, 2022 primary, but it does not mark a winner and no separate certification instrument is retained. Both rows therefore preserve `sourceWinnerStatus: not_marked_by_source`, null identity, and `scoreEligible: false`.

Pinned outputs:

- results v2: 3,823 bytes, SHA-256 `aced4a50b0cf3baafaf0bc54b7cd762fb9312a538f4b6ab33c9068389bfc589e`
- results package: `491b5ec35f4dda3d3410e80be77d39f6fe81580c586e4375f685c6d4f9d9b2ac`
- result set: `259bbb665a8d9d961584caa69b7b402f95b7288520bf7f423c837f61d97f42a0`
- projection v16: 62,738 bytes, SHA-256 `3024e8c366f7ce698cd2729cd57259f5cf8b542a23ad6c8f295fc79d0042c6f1`
- coverage ledger v16: 20,106 bytes, SHA-256 `589d364433889948ee658a062008137354dd07906854b25277d9748fbdd1c0d4`

Reproduction:

```bash
npm run acquire:rapid-house-primary-missouri-2022
npm run generate:rapid-house-primary-missouri-results-v2
npm run generate:rapid-house-primary-projection-v16
```
