# South Carolina rapid House-primary result — 2026-08-08

This rapid slice retains the official South Carolina Elections Database JSON for the 2022 Democratic SC-06 primary. The 8,756-byte source has SHA-256 `fc23e017af8c7afd2c0f89772c1f1caa5e66bb000c0f825b82578dcb6d89b0bd` and identifies contest 3144, election date 2022-06-14, U.S. House district 6, and the Democratic primary.

The v2 extension also retains the official 2024 primary event's complete U.S. House search export. The 19,607,419-byte CSV has SHA-256 `fd0a043f0f1fadeecf8a669ca45c3db25ff974704b878caf7ef74da4974bb10d` and exactly 112,050 detailed rows across nine contests: Democratic districts 1, 2, 3, and 7, plus Republican districts 1, 2, 3, 4, and 6. Because no Democratic district-6 contest appears in that complete event-and-office inventory, the target observation is `source_absent_no_disposition_inference`. Candidate count, votes, winner, identity, and result authority remain null; the package does not infer zero votes, no primary, uncontested status, nomination, or cancellation.

Generated v2 pins:

- South Carolina result package: 4,157 bytes; file SHA-256 `9636141357e7175062e661344b6770e6925008b86cd9ef27cc881bb83fbc83ac`; package `5455c4bb094585f59819b8aa4e38e8059e8807ee9081ada078dfefdc764b21ed`; result set `4438d19b12c4ae6b9d6dc0ac28b06b74018feeae3094252dcc2a2cf4f0919156`.
- Rapid projection v12: 61,526 bytes; file SHA-256 `1c22bb643106fd82dcf3b39f0113853ac3529fd98ce2f79e5f00c8c41bfa540c`; package `62d13e57f90ca495be1af1d0fe2503a885366f2ba0af3e627aeae2a1f8a1fa7c`.
- Coverage ledger v12: 20,059 bytes; file SHA-256 `7c5e2a7f857c1d97a3112c1bccf94fe9e3385fb7915ae81ae18585ffcb56e620`; package `9b2881667d965351d547f5b27e28ecba42a0a219ed02d2303efd8c5e3899b9c2`.

Reproduction commands:

```bash
npm run acquire:rapid-house-primary-south-carolina-2024
npm run generate:rapid-house-primary-south-carolina-results-v2
npm run generate:rapid-house-primary-projection-v12
```

The three candidate rows close exactly to 55,435 votes: James E. Jim Clyburn 48,729; Michael Addison 4,203; and Gregg Marcel Dixon 2,503. The source marks Clyburn as winner and separately reports 28,473 overvotes/undervotes and 83,908 total ballots. A separate certification instrument, current-person identity link, and score authorization are not retained; identity and score eligibility remain null or false.

The older 2024 ENR shell remains retained as acquisition history; the v2 event-search export supplies the complete House contest inventory used for the source-absence observation. It is not converted into a no-primary or uncontested conclusion. The 2026 source remains blocked.
