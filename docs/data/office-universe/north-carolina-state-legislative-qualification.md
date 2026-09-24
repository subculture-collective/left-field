# North Carolina state-legislative qualification packet

**Decision:** `not_qualified`

This packet is an evidence assessment, not a coverage claim or source-configuration authorization. Every unverified source remains explicitly uncollected.

## Packet metadata

| Field | Value |
| --- | --- |
| `packetVersion` | `qualification-packet-v1` |
| `state` | `NC` (North Carolina) |
| `family` | `state_legislative` |
| `cycle` | 2024 general cycle (closed) |
| `cutoffAt` | `2026-08-04T00:00:00Z` |
| `decision` | `not_qualified` |
| `decisionRationale` | None of the eight gates is `retained`. The repository retains North Carolina **primary** result archives (2022, 2024, 2026), two primary state-canvass PDFs, congressional (not state-legislative) plan files, and a mixed local-office primary receipt; no retained artifact covers the 2024 general-election state-legislative office/district universe, filing, certification, calendar, finance, or geography. `data/source-lock.json` records no retrieval timestamp for any entry, so the `retrievedAt` field required by `retained` cannot be sourced. The Open States roster retrieved 2026-09-24 is after `cutoffAt` and is excluded. Advancement conditions 2, 4, 5, and 6 are unmet. No systemic quarantine is recorded. |
| `reviewedSource` | Not applicable (`not_qualified`). |

## Gate rows

| `gate` | `status` | `scope` | `omissions` | `rationale` |
| --- | --- | --- | --- | --- |
| `office_district_universe` | `not_collected` | North Carolina Senate and House offices and districts for the 2024 general cycle, including chamber, district, and effective dates. | Entire scope. | No official legislature or State Board of Elections roster or district catalog for the 2024 general cycle has been collected or reviewed. Retained primary precinct archives carry contest titles, not an office/district catalog with effective dates. |
| `filing` | `not_collected` | Filing rules, filing periods, and ballot-access requirements for North Carolina state-legislative offices in the 2024 general cycle. | Entire scope. | No official candidate filing list, ballot certification, or filing-rule source has been collected. Primary candidate rows in retained archives are not general-election filings. |
| `results_certification` | `not_collected` | Contest-level 2024 general-election results and the applicable certification authority for North Carolina state-legislative contests. | Entire scope; 2024 primary results and the 2024 primary canvass PDF are context only. | No 2024 general-election result archive or general-election canvass instrument has been collected. The retained 2024 primary receipt records `certificationStatus` `separate_state_canvass_instrument_not_bound_for_state_legislative_contests`; the retained primary canvass PDF is neither bound to state-legislative contests nor a general-election instrument. |
| `calendar` | `not_collected` | 2024 general-election date, filing deadline, and rule/rule-change source for North Carolina state-legislative offices. | Entire scope. | No official calendar or deadline source has been collected. The `electionDate` values in retained artifacts are primary dates (2024-03-05). |
| `finance` | `not_collected` | North Carolina campaign-finance authority for state-legislative candidates and committees, availability, filing periods, and amendment handling for the 2024 cycle. | Entire scope. | No finance authority, endpoint, rights statement, or artifact has been collected or reviewed. |
| `geography` | `not_collected` | North Carolina Senate and House district boundaries in effect for the 2024 general cycle and the applicable plan authority. | Entire scope. Retained `nc-2023-enacted-congressional-plan-*` entries are congressional plans and are not state-legislative geography. | No official state-legislative district shapefile, block-assignment file, or plan mapping for the 2024 cycle has been collected. Congressional plan files cannot be reused for Senate or House districts without unsupported inference. |
| `election_system_diversity` | `not_collected` | Partisan, nonpartisan, multimember, term-limit, runoff, and other election-system rules affecting North Carolina state-legislative contests in the 2024 general cycle. | Entire scope. | No rule source has been collected. Retained primary archives and the local-office receipt show partisan and nonpartisan local contests, which do not establish state-legislative general-election rules or second-primary behavior. |
| `missingness` | `not_collected` | Expected offices and contests, observed rows, quarantined rows, and omission reasons across the other seven gates for the 2024 general cycle. | Expected counts are unknown because the office/district universe is not collected. Excluded by cutoff: `openstates-people-nc-20260924` (retrieved 2026-09-24, after `cutoffAt`). Context only, not gate evidence: `rapid-north-carolina-state-legislative-primary-results-v1`, `rapid-north-carolina-local-office-primary-results-v1`, `nc-2024-primary-official-results-archive`, `nc-2024-primary-state-canvass-by-contest`. | A missingness matrix cannot be computed without an expected universe. This row records the known exclusions; it does not convert absent evidence into zero or complete observations. |

## Context artifacts (not gate evidence)

These repository-retained entries are listed so the assessment is replayable. They are primary-election, congressional, or post-cutoff artifacts and satisfy no gate above. Fields are copied from `data/source-lock.json`, which records no retrieval timestamp.

| Lock `id` | `url` | `retainedPath` | `sha256` | `byteSize` | Why excluded |
| --- | --- | --- | --- | --- | --- |
| `rapid-north-carolina-state-legislative-primary-results-v1` | `urn:dsa-seats:rapid-north-carolina-state-legislative-primary-results:v1:2022-2026` | `data/metadata/rapid-north-carolina-state-legislative-primary-results-v1.json` | `038d13a04d24698585cd63f4000605977d9eb9b13a63430fa43590190e0e16e5` | 230534 | Primary receipt (2022, 2024, 2026); 176 contests; not a general-election office universe, filing, certification, calendar, finance, or geography source. |
| `nc-2024-primary-official-results-archive` | `https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2024_03_05/results_pct_20240305.zip` | `data/source/elections/primary-results/north-carolina/2024/official-results.zip` | `0b0475a6df5ecd0d47a21ee51c96782934de768f8ef60eb3a9ae7d83021fea30` | 4464845 | 2024 primary precinct results; not general-cycle evidence. |
| `nc-2024-primary-state-canvass-by-contest` | `https://s3.amazonaws.com/dl.ncsbe.gov/State_Board_Meeting_Docs/2024-03-26/Canvass/Canvass%20Certification%20of%20State%20Jurisdiction%20Contests%20032624.pdf` | `data/source/elections/primary-results/north-carolina/2024/state-canvass-by-contest.pdf` | `1c5259b244ee50474d7105c28b1fd50ff3b8ef76c697759a06dbc9d812e20b00` | 324231 | 2024 primary canvass instrument; not bound to state-legislative contests per the receipt and not a general-election certification. |
| `rapid-north-carolina-local-office-primary-results-v1` | `urn:dsa-seats:rapid-north-carolina-local-office-primary-results:v1:2022-2026` | `data/metadata/rapid-north-carolina-local-office-primary-results-v1.json` | `768006a4fb5e926ec6643c4c793d85ac137160946757ab9b9b91a276e7e88698` | 1496876 | Local-office primary receipt; outside the `state_legislative` family. |
| `nc-2023-enacted-congressional-plan-shapefile` | `https://ncleg.gov/Files/GIS/Plans_Main/Congress_2023/SL%202023-145%20Congress%20-%20Shapefile.zip` | `data/source/elections/primary-results/geography/north-carolina/2024/sl-2023-145-congressional-plan.zip` | `08356ab4db690e8dea60eba42f6b8490e24cd2b711cbde507d1b33f138cf9da5` | 2593712 | Congressional plan, not state-legislative geography. |
| `openstates-people-nc-20260924` | `https://data.openstates.org/people/current/nc.csv` | `data/source/rapid/state-legislative-roster/20260924/nc.csv` | `87c367e09203bd16c3d87b5a703678c40bdda15b83270cc740bbe9a8a3a741d0` | 102060 | CC0 current-legislator roster retrieved 2026-09-24, after `cutoffAt`; a current roster is also not a 2024-cycle office/district catalog. |

## Advancement status

Condition 1 holds (one state, `state_legislative`, one closed cycle, UTC cutoff). Conditions 2 through 6 are unmet: no gate is `retained`, no reviewed source is bound, no replay of gate evidence is possible, and no manual shadow run has occurred. The next step, if pursued, is to retain an official 2024 general-cycle office/district catalog with a recorded retrieval time at or before `cutoffAt`; this packet does not authorize that acquisition.
