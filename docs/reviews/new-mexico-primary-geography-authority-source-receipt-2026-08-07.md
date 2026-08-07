# New Mexico primary geography authority source receipt — 2026-08-07

The repository now retains the official Census TIGER2022 New Mexico CD118 archive alongside the existing TIGER2025 CD119 archive and Census CD119 plan-change page.

The CD118 archive is 621,463 bytes with SHA-256 `88d8b5566cee6778eceb0809ae84165eac6db2a50653ee36df831791d241bc1b`. Its DBF member is 754 bytes with SHA-256 `e5210b9426fbd49dd96a1d18eb4565101e0ff674c470ee079e1da734acc4eb8b`; it contains exactly three active New Mexico rows, session 118, GEOIDs 3501–3503. The retained CD119 DBF contains exactly the same three numbered keys for session 119.

The Census authority page identifies Alabama, Georgia, Louisiana, New York, and North Carolina as the five states that redrew for the 119th Congress; New Mexico is excluded. These inputs can support a bounded 2022 CD118-to-CD119 continuity candidate and exact 2024 CD119-key candidate. They do not establish raw geometry equality, population equivalence, approval, or a 2026/CD120 relationship. CD120 remains authority-pending.

Acquisition is create-only and hash-guarded:

```bash
npm run fetch:nm-primary-geography-authority
npm run data:verify
```
