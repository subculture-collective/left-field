# Rapid Vermont House-primary results — 2026-08-08

This rapid acquisition closes Vermont's two completed target observations from official Secretary of State canvassing-committee reports while keeping identity and score decisions separate.

## Retained authority

- The 2022 official canvass PDF is 817,821 bytes with SHA-256 `9e297acae57327843f07c278e1b438eb40d73650fd89262569aa806564054087`; its deterministic `pdftotext -layout` extract is 1,297,652 bytes with SHA-256 `5da75e57b23fb5ebc42271461c966ade091d92fb3ba4454d66b7911c14358bf1`.
- The 2024 official canvass PDF is 875,263 bytes with SHA-256 `a414c1dc46e1fa3ff5544dee58993e16e0cf02f0b626abb82ba665fd2face8e6`; its deterministic extract is 1,315,055 bytes with SHA-256 `542447cd506a17f901ec8eafb24fb48185ea383a9862bee653cee13412f7588d`.
- Each derived text node directly parents its PDF. The result artifact directly parents all four retained nodes.

## Result boundary

The 2022 Democratic at-large contest contains Becca Balint 61,025; Sianay Chase Clifford 885; Molly Gray 37,266; and Louis Meyers 1,593, for 100,769 named-candidate votes. The report separately gives 145 write-ins, 74 overvotes, 1,420 blank votes, and 102,408 total votes counted. Its winner styling is not converted into a machine-readable winner claim by the text extract.

The 2024 contest contains Becca Balint 47,638, plus 465 write-ins, 13 overvotes, 3,853 blank votes, and 51,969 total votes counted. The retained report explicitly marks Balint with an asterisk under its `Winners = Bold*` convention, so the observation preserves `marked_by_source`; current-person identity and score eligibility remain null or false.

Both rows are official canvass observations, not independently approved scoring inputs. The rapid projection remains identity-null, winner-identity-null, reviewer-independent, and score-ineligible.

## Reproduction

```bash
npm run acquire:rapid-house-primary-vermont
npm run generate:rapid-house-primary-vermont-results
npm run generate:rapid-house-primary-projection-v9
npx vitest run src/rapid-acquisition/house-primary-vermont-results.test.ts src/rapid-acquisition/house-primary-projection-v9.test.ts src/ui/rapid-house-primary-coverage.test.ts
npm run typecheck
npm run data:verify
```
