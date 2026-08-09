# Kentucky state-legislative primary results receipt — 2026-08-09

The official Kentucky Secretary of State result PDFs now produce a deterministic, score-ineligible context projection for the 2022, 2024, and 2026 state House and Senate primaries.

The projection closes 134 reported Democratic or Republican party contests: 25 Senate and 109 House; 43 Democratic and 91 Republican. It retains 298 candidate rows and 689,016 votes. Cycle totals are 54 contests / 116 candidates / 274,179 votes in 2022, 41 / 92 / 180,152 in 2024, and 39 / 90 / 234,685 in 2026.

Each exact PDF is paired with a source-locked `pdftotext -tsv` 26.07.0 coordinate extract. The parser binds the chamber, district, party, candidate columns, and reported `Total Votes` row and requires every emitted total to equal its candidate sum. The 2022 extract is 572,474 bytes (`261a6f4598e7d8824cac99ccdc291fc9171c40333f1a351d0c0f3cf3b1a050b3`); 2024 is 614,858 bytes (`434738afc72012ecd7b44fd086c33ecfeeb5745329d8edaee1eb04268f27a1c7`); 2026 is 873,018 bytes (`8482d375ecc509e6a776f407ebb15a26357a24c6ad29d28c7e48bc5ddec48765`).

The 2026 input is explicitly the official statewide certification-of-vote-totals PDF. The 2022 and 2024 inputs are official result PDFs without a separately retained candidate-level certification instrument. None of the three sources supplies a parsed winner identity used here, so vote rank never creates a winner. Candidate identity, ideological classification, evaluator values, and House-score eligibility remain unset.

`npm run generate:rapid-kentucky-state-legislative` reproduces the 148,888-byte artifact SHA-256 `3d5fb0f1af4bb217a20f2e7ebaa16d794033df745b9805fa12011987392b932d`, contest-set SHA-256 `5c1313a1ef3c21bacfaea600dadb7bde58fc06a27d812304b290983b70b84a7b`, and package SHA-256 `f2cde60a593c8e84520625cb01e5906bdd9300ba1a0b1fc22dec9d888c54e19c`.
