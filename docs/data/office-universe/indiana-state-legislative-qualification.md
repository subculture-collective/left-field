# Indiana state-legislative qualification packet

**Decision:** `not_qualified`

This packet is an evidence assessment, not a coverage claim or source-configuration authorization. Every unverified source remains explicitly uncollected.

## Packet metadata

| Field | Value |
| --- | --- |
| `packetVersion` | `qualification-packet-v1` |
| `state` | `IN` (Indiana) |
| `family` | `state_legislative` |
| `cycle` | 2024 general cycle (closed) |
| `cutoffAt` | `2026-08-04T00:00:00Z` |
| `decision` | `not_qualified` |
| `decisionRationale` | None of the eight gates is `retained`. The repository retains only Indiana **primary** result artifacts (2022 and 2024) and a 2024 local-office primary archive; no retained artifact covers the 2024 general-election office/district universe, filing, certification, calendar, finance, or geography. `data/source-lock.json` records no retrieval timestamp for any entry, so the `retrievedAt` field required by `retained` cannot be sourced. The Open States roster retrieved 2026-09-24 is after `cutoffAt` and is excluded. Advancement conditions 2, 4, 5, and 6 are unmet. No systemic quarantine is recorded. |
| `reviewedSource` | Not applicable (`not_qualified`). |

## Gate rows

| `gate` | `status` | `scope` | `omissions` | `rationale` |
| --- | --- | --- | --- | --- |
| `office_district_universe` | `not_collected` | Indiana Senate and House offices and districts for the 2024 general cycle, including chamber, district, and effective dates. | Entire scope. | No official legislature or election-authority roster or district catalog for the 2024 general cycle has been collected or reviewed. Retained primary result files list contest titles by district but are not an office/district catalog and do not carry effective dates. |
| `filing` | `not_collected` | Filing rules, filing periods, and ballot-access requirements for Indiana state-legislative offices in the 2024 general cycle. | Entire scope. | No official filing list, ballot certification, or filing-rule source has been collected. Primary candidate rows in retained artifacts are not general-election filings and carry no filing-period or ballot-access facts. |
| `results_certification` | `not_collected` | Contest-level 2024 general-election results and the applicable certification authority for Indiana state-legislative contests. | Entire scope; 2024 primary results are context only. | No 2024 general-election result artifact or certification instrument has been collected. The retained 2024 primary receipt records `certificationStatus` `settings_certified_true_no_separate_certificate`, which is a primary-election archive flag, not a general-election certification. |
| `calendar` | `not_collected` | 2024 general-election date, filing deadline, and rule/rule-change source for Indiana state-legislative offices. | Entire scope. | No official calendar or deadline source has been collected. The `electionDate` values in retained artifacts are primary dates (2024-05-07). |
| `finance` | `not_collected` | Indiana campaign-finance authority for state-legislative candidates and committees, availability, filing periods, and amendment handling for the 2024 cycle. | Entire scope. | No finance authority, endpoint, rights statement, or artifact has been collected or reviewed. |
| `geography` | `not_collected` | Indiana Senate and House district boundaries in effect for the 2024 general cycle and the applicable plan authority. | Entire scope. | No official or Census-compatible state-legislative district artifact has been collected. No retained Indiana geography entry exists in `data/source-lock.json`. |
| `election_system_diversity` | `not_collected` | Partisan, nonpartisan, multimember, term-limit, runoff, and other election-system rules affecting Indiana state-legislative contests in the 2024 general cycle. | Entire scope. | No rule source has been collected. Retained primary artifacts show party-labeled primary contests but do not establish general-election rules or exceptions. |
| `missingness` | `not_collected` | Expected offices and contests, observed rows, quarantined rows, and omission reasons across the other seven gates for the 2024 general cycle. | Expected counts are unknown because the office/district universe is not collected. Excluded by cutoff: `openstates-people-in-20260924` (retrieved 2026-09-24, after `cutoffAt`). Context only, not gate evidence: `rapid-indiana-state-legislative-primary-results-v1`, `rapid-indiana-local-office-primary-results-v1`. | A missingness matrix cannot be computed without an expected universe. This row records the known exclusions; it does not convert absent evidence into zero or complete observations. |

## Context artifacts (not gate evidence)

These repository-retained entries are listed so the assessment is replayable. They are primary-election or post-cutoff artifacts and satisfy no gate above. Fields are copied from `data/source-lock.json`, which records no retrieval timestamp.

| Lock `id` | `url` | `retainedPath` | `sha256` | `byteSize` | Why excluded |
| --- | --- | --- | --- | --- | --- |
| `rapid-indiana-state-legislative-primary-results-v1` | `urn:dsa-seats:rapid-indiana-state-legislative-primary-results:v1:2022-2024` | `data/metadata/rapid-indiana-state-legislative-primary-results-v1.json` | `83edd620b792c56121d819a74706747cec7b5f983e4c1b79df12f8cecc727967` | 340618 | Primary receipt (2022, 2024); 361 contests; not a general-election office universe, filing, certification, calendar, finance, or geography source. |
| `in-2024-primary-settings` | `https://enr.indianavoters.in.gov/archive/2024Primary/data/settings.json` | `data/source/rapid/house-primary/in/2024/settings.json` | `430de937a82b87f5320a5047d37877f44612f824e3fc3696d650bbcfc61692cb` | 3028 | 2024 primary archive settings; not general-cycle evidence. |
| `in-2024-primary-state-senate-results` | `https://enr.indianavoters.in.gov/archive/2024Primary/data/OffCatC_1018_B.json` | `data/source/rapid/state-legislative/in/2024/state-senate-results.json` | `ab4459eb9167726633102e447814af7dea2903b394b872685f9aec51ddb69bd6` | 76767 | 2024 primary Senate results; not general-cycle evidence. |
| `in-2024-primary-state-house-results` | `https://enr.indianavoters.in.gov/archive/2024Primary/data/OffCatC_1039_B.json` | `data/source/rapid/state-legislative/in/2024/state-house-results.json` | `63aca0ab21d7296dc54362d53197912a24d31b97af42e8051f3a3a3ceaab4fd8` | 296437 | 2024 primary House results; not general-cycle evidence. |
| `rapid-indiana-local-office-primary-results-v1` | `urn:dsa-seats:rapid-indiana-local-office-primary-results:v1:2024` | `data/metadata/rapid-indiana-local-office-primary-results-v1.json` | `cd1de076b95cde9dae35cd0ed64f520e999a25c3a49be84febc9ec49b5b79209` | 908787 | 2024 local-office primary receipt; outside the `state_legislative` family. |
| `openstates-people-in-20260924` | `https://data.openstates.org/people/current/in.csv` | `data/source/rapid/state-legislative-roster/20260924/in.csv` | `4eed612337df872f8aaf9c02a4534fd07cdf51727e9ebb4db610f224d31dbe3b` | 182231 | CC0 current-legislator roster retrieved 2026-09-24, after `cutoffAt`; a current roster is also not a 2024-cycle office/district catalog. |

## Advancement status

Condition 1 holds (one state, `state_legislative`, one closed cycle, UTC cutoff). Conditions 2 through 6 are unmet: no gate is `retained`, no reviewed source is bound, no replay of gate evidence is possible, and no manual shadow run has occurred. The next step, if pursued, is to retain an official 2024 general-cycle office/district catalog with a recorded retrieval time at or before `cutoffAt`; this packet does not authorize that acquisition.
