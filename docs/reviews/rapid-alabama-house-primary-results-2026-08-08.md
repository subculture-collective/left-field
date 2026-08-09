# Rapid Alabama House-primary results — 2026-08-08

This rapid acquisition closes four target observations from official Alabama Secretary of State precinct-workbook downloads while leaving identity, geographic compatibility, certification, winner, and score decisions separate.

## Retained sources

| Event | Bytes | SHA-256 |
| --- | ---: | --- |
| 2022 primary ZIP | 956,619 | `d927aa38b0be4f855833648aeb873a537db8a222172bb630044b026622a23999` |
| 2024 primary ZIP | 705,832 | `8423328e37a00b430d23ea034547bc354d2c71f4038c950a4dc882aa08333cd2` |
| 2024 runoff ZIP | 165,748 | `1538e5a6848a4989fe856cf538dd279f4992a8c9fdac6d6cd03978ad8017cdae` |

The generator expands exactly 67 county XLS members for each regular primary and 28 for the runoff, converts each workbook with an isolated LibreOffice profile, and sums literal precinct values by source contest, party, and candidate. It canonicalizes only the two source spellings of Juandalynn Givan that differ by spacing inside the nickname.

## Target closure

| Observation | Status | Candidate rows | Candidate votes |
| --- | --- | ---: | ---: |
| 2022 AL-02 Democratic regular primary | reported | 2 | 24,557 |
| 2022 AL-07 Democratic regular primary | source absent | — | — |
| 2024 AL-02 Democratic regular primary | reported | 11 | 57,518 |
| 2024 AL-07 Democratic regular primary | reported | 2 | 63,803 |
| 2024 AL-02 Democratic runoff | distinct evidence | 2 | 35,968 |

The regular-primary projection contains 145,878 candidate votes. The runoff remains a separate evidence object and is never folded into the regular-primary denominator. The workbooks contain no winner marker, so neither vote rank nor the runoff is converted into a source winner or nominee. The 2022 AL-07 absence is not converted into zero votes, no primary, an uncontested nomination, or a candidate-identity conclusion.

Generated result artifact: 3,938 bytes, SHA-256 `16cb706239d1099be980774496470c9b66bd5b1eaf1e937877362584f8d9c322`. Projection v8: 60,941 bytes, SHA-256 `75bfcc1c00057a9927e49dcc95c5b1aa6ae672257bd826159bb7725073d4ca28`. Coverage ledger v8: 20,149 bytes, SHA-256 `431f9585a9b8c082c27263d1bcf70edb0f8d3a068e9bcaae8ff2293662e2f66c`.
