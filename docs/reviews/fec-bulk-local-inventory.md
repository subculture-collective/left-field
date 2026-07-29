# Local FEC bulk inventory

This is an offline, privacy-safe inventory of the ignored local `FEC/` directory. It hashes outer archives only; it does not parse records. `indiv16` and `indiv18` are prohibited because they contain contributor PII. All `oth`, `pas2`, and `oppexp` archives are prohibited unopened. `oth16` duplicate variants have the same SHA-256 and are recorded as one duplicate-hash group.

The outer-only inventory found **57 completed ZIP archives**: 37 registry/summary archives classified as bootstrap candidates and 20 contributor/vendor transaction archives classified as prohibited. Incomplete `.crdownload` files are excluded.

Only `cn26.zip`, `cm26.zip`, `ccl26.zip`, and `weball26.zip` are selected bootstrap inputs. `weball` is reconciliation-hint-only; it is not filing/amendment closure. OpenFEC reports API remains required for filing and amendment review. The current bootstrap is not publication eligible and requires signed review.

| archive | bytes | sha256 | member | rows | fields |
|---|---:|---|---|---:|---:|
| cn26.zip | 298955 | 73a24608be62fc2cf9fee05d1493f5a99d60c1a866a76f3a68144f4047fb6b3b | cn.txt | 8236 | 15 |
| cm26.zip | 849874 | 80172c5fb5af2dfb1c22b9652d07fe872297ba85fbb09c69565b8685488078f5 | cm.txt | 20241 | 15 |
| ccl26.zip | 85363 | a8994e88ebe860cbdbad950f2ec7a7fc0f2f22c42e70b236b645b45760420433 | ccl.txt | 7811 | 7 |
| weball26.zip | 191402 | fbd72b09dffae45198efa6a79e189cc7f32b4e62a30f97c7424d4416108a4d44 | weball26.txt | 4255 | 30 |

Other current-cycle archives are explicitly excluded from bootstrap:

| archive | bytes | sha256 | disposition |
|---|---:|---|---|
| oppexp26.zip | 103147 | 35fcc93d9be0ed4238077ff47616908c14923e0568cb48fed7b4a42fcfcfa420 | prohibited vendor/payee transactions |
| oth26.zip | 29622 | 7e438997c5ae177523398597aa393ec3065a9c2e196c0302f5768b8dceb5b945 | prohibited counterparty transactions |
| pas226.zip | 140272 | d699f816515877d09dc6fa3ef3cc75a5f5cc8d56a0a11614937ba72609ea438e | prohibited committee/candidate transactions |
| webk26.zip | 344612 | ebf976af6d6a51d6f8560408003f67b890c7853ff279f5af6ba62d1084f46600 | excluded redundant PAC/party summary |
| webl26.zip | 144656 | 1b64fa9bbaf58ab89f68b954168fa86588dd03c43ccbe4c90605b603b2a44273 | excluded redundant congressional summary |

Duplicate group: `oth16.zip`, `oth16 (1).zip`, and `oth16 (2).zip` all have SHA-256 `ea56462c629664309cdb371c4bddda6c64870c3e6acb2bfcfa143426508a1bc0`.

The exact four current-cycle archives are **not snapshot-coherent**: local analysis found 117 candidate principal-committee references absent from `cm26`, 140 retained 2026 linkage candidate references absent from `cn26` (after excluding two unsupported `C...` identifiers), 176 linkage committee references absent from `cm26`, and four `weball26` candidate references absent from `cn26`. The bootstrap records these as explicit canonical `coherence` gaps in a quarantined `publicationEligible:false` artifact. No downstream publication path may consume it until official OpenFEC reconciliation clears every gap and an independent reviewer signs the resulting mapping.

Local hashes prove local byte identity only; they do not prove official origin or cutoff eligibility.
