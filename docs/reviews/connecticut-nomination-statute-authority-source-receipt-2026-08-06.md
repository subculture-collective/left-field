# Connecticut nomination-statute authority source receipt — 2026-08-06

## Cycle-specific official instruments

| Use | Official CGA instrument | Bytes | SHA-256 |
|---|---|---:|---|
| 2022 base law | 2021 published Chapter 153 | 371,695 | `a7b5d6cfff1f702eda31605f37ffbe82afe6c7228c5aa0be08a602101e6c6e33` |
| 2022 amendments check | 2022 Chapter 153 supplement | 51,593 | `955ff66d75f59c30679399e51bfcbce34eed1d2d34099eada7ed08ec8d852b64` |
| 2024 base law | 2023 published Chapter 153 | 389,864 | `f422baa761ad7fbcff8a8883e997ca0077c6b1f940dcc1749b240b83f57c8c59` |
| 2024 operative amendments | 2024 Chapter 153 supplement | 42,304 | `b6b1f2a94b17591a3447dad2e27cfb871b23f334f73b012702c5a5615c98331a` |

For 2022, the 2021 publication contains §§ 9-400, 9-415, 9-416, 9-426, and 9-429; the 2022 supplement contains no amendment to those sections. For 2024, the 2023 publication supplies §§ 9-400, 9-415, and 9-416, while the 2024 supplement supplies the P.A. 23-5 amendments to §§ 9-426 and 9-429 effective January 1, 2024.

The material timing difference is retained explicitly: the relevant 2022 cancellation provisions use the pre-polls timing, while the amended 2024 office-primary provisions use commencement of early voting. The acquisition does not project the 2024 amendment backward.

## Evidence boundary

The statutes define conditional consequences; they do not prove that the conditions occurred in any Connecticut district-cycle. The current evidence does not establish whether another timely conforming candidacy existed, whether the 15-percent threshold was met, whether a petition was valid, or whether any candidate died, withdrew, became disqualified, was replaced, or triggered cancellation. No nomination, uncontested-primary, no-primary, winner, ballot-placement, certification, evaluator, score, approval, publication, or deployment state is created by retaining the law.

## Verified TLS recovery

The CGA server served a valid hostname/date certificate but omitted its GoDaddy intermediate. The fetcher does not disable verification. It pins the AIA-named intermediate bytes, verifies the live leaf through that intermediate to `/etc/ssl/certs/ca-certificates.crt`, constructs a temporary completed CA bundle, and lets `curl` verify HTTPS hostname, dates, and chain. The temporary chain material is removed after acquisition.

```bash
npm run fetch:ct-nomination-statutes
npm run test:run -- scripts/fetch-connecticut-nomination-statutes.test.ts
npm run data:verify
```
