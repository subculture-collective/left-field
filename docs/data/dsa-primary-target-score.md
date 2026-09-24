# DSA primary target evaluation v0.1

> Active model v0.9 (2026-09-23): Republican-held seats no longer receive a flat 0.70 multiplier. Their route is a coverage-scaled combination of general-election competitiveness (0.45), cash vulnerability (0.20), exact at-large local context (0.15), and state-level Democratic primary contestation (0.20); available weights are renormalized and multiplied by `0.6 + 0.4 × available weight`, the same partial-coverage rule the Democratic route applies. The state contestation component comes from the retained state-legislative primary catalogs. A reviewed identity alias table also resolves RI-01's direct 2024 primary evidence. See [the v0.9 review note](../reviews/house-priority-republican-route-v09-2026-09-23.md).

> Deadline extension: the separately versioned `dsa-primary-target-provisional-v0.2` adds a 25% incumbent-alignment gap from the retained Left and Palestine trackers. It preserves v0.1 scores for the 140 originally qualified seats and uses an explicit component fallback to order the other 72, without mutating v0.1. See [the v0.2 review note](../reviews/dsa-target-provisional-score-v02-2026-08-07.md).

## Goal and scope

This evaluation ranks regular, occupied, voting U.S. House seats held by a Democrat for a potential left primary challenge. It is a strategic target score, not a probability of winning. It does not consume individual-voter records, individual-donor identities, addresses, or demographic attributes.

The score selects the higher of two independently qualified routes:

1. **Deep-blue route:** a seat whose conservative two-cycle Democratic presidential-margin floor is at least 20 percentage points.
2. **AIPAC-supported-blue route:** a seat whose conservative Democratic presidential-margin floor is at least 8 points and whose incumbent has qualifying AIPAC-network financial support evidence.

The application may infer AIPAC support automatically from pinned committee IDs and FEC transactions. The inference remains reproducible through retained source snapshots even if the public list does not require a reviewer to apply a label manually.

## Formula

All component scores are bounded to `0..100`.

```text
blue_baseline = clamp((minimum Democratic presidential margin - 5) * 4, 0, 100)

deep_blue_route = 0.70 * blue_baseline
                + 0.30 * primary_feasibility

aipac_supported_blue_route = 0.60 * aipac_support
                           + 0.25 * blue_baseline
                           + 0.15 * primary_feasibility

target_score = maximum qualified route
```

Positive presidential margins mean Democratic margin over Republican. The minimum compatible 2020/2024 margin is used so one unusually strong cycle cannot make an unstable seat look historically safe. With only one compatible cycle, the formula may emit a partial inference and reports 50% blue-baseline coverage.

### Primary feasibility

The feasibility component starts with the original PRD's non-baseline primary factors and adds two aggregate election-history factors that describe the scale and demonstrated progressive constituency of the seat:

| Input | Internal weight | Transform |
| --- | ---: | --- |
| Prior incumbent primary margin | 25 | `clamp(100 - 2 * margin_points, 0, 100)` |
| Incumbent cash on hand | 20 | Inverse log scale: 100 at or below $50,000; 0 at or above $5 million |
| Incumbent tenure | 15 | `clamp(100 - 4 * tenure_years, 0, 100)` |
| Filing runway | 10 | `clamp(days_remaining / 365 * 100, 0, 100)` |
| Prior Democratic primary votes | 15 | Inverse log scale: 100 at or below 20,000 votes; 0 at or above 250,000 |
| Prior progressive primary vote share | 15 | `clamp(2 * vote_share, 0, 100)` |

Available factors are renormalized by their available weight. Partial feasibility is then multiplied by `0.6 + 0.4 * coverage`, preventing a seat with one favorable observation from receiving the same score as a complete record. If every feasibility factor is missing, the evaluator uses a conservative value of 30 with zero coverage. Primary vote totals are aggregate contest results, not modeled individual turnout propensity.

### AIPAC support inference

Version 0.1 recognizes only exact FEC committee identities:

| Committee | FEC ID | Accepted evidence |
| --- | --- | --- |
| American Israel Public Affairs Committee PAC | `C00797670` | Direct contribution to the incumbent's authorized committee |
| United Democracy Project | `C00799031` | Independent expenditure supporting the incumbent or opposing an incumbent's primary challenger |

Direct contributions and independent expenditures are not treated as equivalent transactions. Each produces a bounded signal with cycle-recency decay; multiple signals combine as `1 - product(1 - signal)`. Current-cycle evidence receives full weight, the prior cycle 70%, and two cycles prior 45%. The AIPAC-supported route gives this component 60% of its total score.

Every qualifying record is bound to latest-revision transaction identities, positive net amount, exact FEC candidate identity, seat, primary-election relationship, and release snapshot closure. Direct contributions must reach an authorized committee mapped to the incumbent. Independent spending must either support that incumbent or oppose a demonstrated same-seat Democratic primary challenger. Corrective/amended transactions are netted before evaluation; a zero or negative net is not support evidence.

United Democracy Project's inclusion in the AIPAC network requires the versioned organization-classification record `org-classification-aipac-network-v1` and its retained source snapshot in addition to FEC transaction evidence. Committee identity alone does not prove the editorial network classification.

An absence of evidence is treated as a true zero only when direct-contribution and independent-expenditure collection is complete for the current and two prior cycles. Every completeness claim must reference retained source snapshots for that channel and cycle. Otherwise the component is explicit `not_collected`, has no numeric score, and cannot qualify the AIPAC route. Organization-name substring matching is prohibited.

The source adapter projects the official FEC PAS2 committee-to-candidate file and independent-expenditure file into this contract. For direct contributions it accepts transaction types `24K`, `24P`, and `24Z`, includes memo-coded records, requires a primary election indicator, and checks the exact recipient against a reviewed authorized-committee mapping. For independent expenditures it requires the UDP committee ID, primary election indicator, exact `S` or `O` direction, and reviewed candidate-to-seat relationship. In both channels it selects the greatest file number for a transaction identity, nets the remaining latest signed identities within the candidate relationship, and omits non-positive groups.

## Current release readiness

The August 4, 2026 factual release can populate:

- current Democratic incumbent and occupied voting-House eligibility;
- 2024 Democratic presidential margin after reversing the repository's current Republican-minus-Democratic display sign;
- incumbent cash on hand;
- candidate-linked United Democracy Project organization totals, which are useful for locating source records but are **not qualifying AIPAC-route evidence** because the published aggregate discarded organization-specific support/opposition direction and transaction identity.

The following acquisitions are required for complete v0.1 rankings:

1. Compatible 2020 presidential results on current district boundaries.
2. Nationwide Democratic House-primary results for at least the 2022, 2024, and current cycles, including uncontested dispositions and vote totals.
3. AIPAC PAC Schedule B direct contributions keyed from `C00797670` through recipient committee and candidate mappings.
4. Filing deadlines and election-system rules from state election authorities.
5. Reviewer approval of the retained incumbent-tenure methodology candidate; the exact 212-seat candidate now exists and is used only under its reversible reviewer-only default.
6. Complete current and two-prior-cycle independent-expenditure closure for `C00799031`, preserving support/opposition, primary-election context, candidate identity, latest amendment/file identity, and signed net amount rather than organization totals alone.
7. A versioned, reviewed organization-classification record establishing why `C00799031` is included in the AIPAC network, with effective dates and correction history.

Aggregate primary turnout and prior progressive-challenger performance are formula inputs, but remain missing until nationwide, geography-compatible sources are selected. Local DSA chapter capacity, endorsements, candidate quality, polling, and field strength should be maintained as separate reviewer inputs; they describe a campaign and organization, not an intrinsic seat condition.

The first cross-source current-incumbent linkage candidate now accounts for all 41 NJ/PA current-target seat-cycle observations available in retained state receipts. It proposes 18 exact-name, nine mechanically derived, and six explicitly inferred relationships while preserving eight historical nonappearances. It automatically approves no identity, selects no contest, resolves no historical geography, and supplies no evaluator number. It supports the existing historic-candidate identity decision rather than creating a new decision. See [`current-incumbent-primary-candidate-linkage-candidate-v1-2026-08-05.md`](../reviews/current-incumbent-primary-candidate-linkage-candidate-v1-2026-08-05.md).

The sibling NJ/PA geography candidate binds those same 41 observations to exact Census CD118/CD119 archives and the official CD119 redraw-scope statement. It proposes 16 CD118-to-CD119 plan-continuity relationships and 16 exact CD119 session/key relationships; all nine 2026 NJ rows remain unassessed pending authoritative CD120 evidence. It does not equate raw TIGER coordinate vintages, approve geography, mutate identity, or provide an evaluator number. See [`nj-pa-primary-geography-compatibility-candidate-v1-2026-08-05.md`](../reviews/nj-pa-primary-geography-compatibility-candidate-v1-2026-08-05.md).

The joint NJ/PA reviewer package makes the intersection inspectable without collapsing those gates: 25 rows have both candidates, eight have an identity candidate with CD120 geography pending, seven have a geography candidate with identity unresolved, and one has both states pending. It inherits the two existing unresolved decision IDs from the August 4 proposal, contains no independent or promotion decision, and keeps all 41 rows evaluator-excluded. Candidate names, numbers, votes, and source markers are omitted from the joined queue. See [`nj-pa-primary-identity-geography-review-package-v1-2026-08-05.md`](../reviews/nj-pa-primary-identity-geography-review-package-v1-2026-08-05.md).

Joint v2 recomposes that immutable queue with geography v2: 33 rows now have both candidates and eight have a geography candidate with identity unresolved. The identity evidence is unchanged, all nine 2026 historical CD120 GEOIDs remain null, and the two inherited decisions remain unsigned and unresolved. Geography evidence advances to the v2 package and row set without approving any row or enabling scoring or publication. See [`nj-pa-primary-identity-geography-review-package-v2-2026-08-06.md`](../reviews/nj-pa-primary-identity-geography-review-package-v2-2026-08-06.md).

The certification-availability assessment separately binds six NJ/PA state-cycles to official authority. New Jersey's three official result lists remain distinct from the Secretary canvass and certificate required by N.J.S.A. 19:23-57 for the state or portions thereof involving more than a single county or congressional district; those instruments were not located or retained. Pennsylvania's 2024 and 2026 statewide certification statements are now retained, but neither binds exact precinct-result bytes; the 2026 result extract itself remains unretained. Across the six rows, five result artifacts are retained and zero are certification-reconciled or evaluator-eligible. The artifact informs the existing nationwide result-and-certification decision and creates no new decision. See [`nj-pa-primary-certification-availability-assessment-v1-2026-08-05.md`](../reviews/nj-pa-primary-certification-availability-assessment-v1-2026-08-05.md).

Joint review v3 composes that assessment into the immutable 41-row joint-v2 queue without changing any identity or geography projection. Availability context is attached by state and cycle to 27 New Jersey and 14 Pennsylvania records; all 41 remain certification-unreconciled. PA-2026 remains assessment-only context because no result extract or joint row exists. The composition adds one inherited unresolved review of the existing nationwide result-and-certification decision, creates no independent decision, and keeps every record evaluator-excluded and score-ineligible. See [`nj-pa-primary-identity-geography-review-package-v3-2026-08-07.md`](../reviews/nj-pa-primary-identity-geography-review-package-v3-2026-08-07.md).

## Current factual projection status

The immutable v1 reviewer report evaluates the exact 212-seat eligible universe from published release `rel_full_20260804_v2`. It has a compatible 2024 presidential margin for 212/212 seats and current cash-on-hand for 210/212. Its other factors remain explicitly missing.

The additive v2 report uses 212/212 cumulative recorded House-service values under one exact reversible default: `use_in_reviewer_only_evaluation_exclude_from_publication`. Service is summed from half-open source-recorded House terms through the inclusive 2026-08-04 cutoff, divided by 365.2425 days per year, and excludes time out of office. BioGuide identity connects district changes; Senate and nonvoting-delegate terms are excluded. The candidate contains nine materially interrupted and 50 district-changing careers, but the report exposes only the aggregate tenure value, fact hash, methodology, and candidate status—not raw career history. The methodology decision remains unresolved and blocks publication.

Reports v1 and v2 produce 117 deep-blue qualifications and 95 non-qualifications; v2 recalculates feasibility scores and ranks after adding tenure. Foundation v2 preserves every signed v1 relationship, applies the mechanical `H0IL07167` disposition, and keeps six incumbent proposals pending. Historical numeric AIPAC v2 replays the frozen source closure through that relationship layer: 206 seats are complete, six are blocked, and 274 evidence groups are retained.

Additive numeric v4 applies foundation v4's complete mapping closure without changing the frozen transaction sources. It retains 278 groups across 127 seats, closes all 212 seats, and represents MA-06/NH-01 2026 as four not-applicable cells rather than zero. CA-31's source-locked 2024 relationship closes both previously blocked channels as complete-zero because neither frozen transaction source contains a qualifying match. Additive report v6 keeps report v2 as the unchanged comparison baseline. Of 212 numeric-complete seats, 202 are evaluator-compatible after excluding eight Washington top-two seats and the two current-cycle House-inapplicable seats. It uses 261 evidence groups across 119 seats, selects the AIPAC route for 52 seats, and produces 140 partial qualifications and 72 partial non-qualifications. CA-31 gains a complete AIPAC component of zero but remains without a selected route or target score; MA-06 and NH-01 retain null AIPAC components, and all eight Washington seats remain formula-incompatible. These remain reviewer-only proposals—not reviewed, published, or public application data. Every earlier numeric/report version remains immutable. See [`ca31-terminal-fec-chain-receipt-2026-08-05.md`](../reviews/ca31-terminal-fec-chain-receipt-2026-08-05.md), [`dsa-target-evaluation-review-report-v6-2026-08-05.md`](../reviews/dsa-target-evaluation-review-report-v6-2026-08-05.md), [`aipac-numeric-evidence-candidate-v4-2026-08-05.md`](../reviews/aipac-numeric-evidence-candidate-v4-2026-08-05.md), [`aipac-numeric-review-package-v4-2026-08-05.md`](../reviews/aipac-numeric-review-package-v4-2026-08-05.md), and [`incumbent-tenure-review-proposal-2026-08-04.md`](../reviews/incumbent-tenure-review-proposal-2026-08-04.md).

Sensitivity candidate v1 freezes report v6, numeric v4, and the unresolved decision in review package v4; it informs that existing decision without replacing or resolving it. It reproduces the baseline route/score/rank for all 212 seats and changes no v0.1 or public value. At 40/40/20, the qualified and selected-route counts are unchanged, but 26 seats move at least ten ranks and top-10 overlap falls to seven. At 75/15/10, one deep-blue route becomes AIPAC-supported, 46 seats move at least ten ranks, and top-10 overlap is nine. A separate common-history 2022/2024 four-cell scenario changes 17 selected routes and one qualification; it is a new formula candidate, not v0.1. That scenario excludes 2026 evidence and coverage but preserves the v0.1 2026 recency anchor, weighting 2024 at 0.7 and 2022 at 0.45. MA-06/NH-01 shortened-window values remain explicitly nonrankable diagnostics. The result supports retaining 60/25/15 plus fixed six-cell exclusion as the reversible default while the normative scoring decision remains unresolved. See [`dsa-target-score-sensitivity-v1-2026-08-05.md`](../reviews/dsa-target-score-sensitivity-v1-2026-08-05.md).

The retained FEC 2026 congressional calendar now supplies a complete 38-state discovery enumeration for filing deadlines, but zero filing-runway values enter the evaluator. The FEC says dates may change and disclaims state election administration authority, so every numeric fact still requires retained state authority. The authority proposal also identifies a formula-scope defect: California, Louisiana, and Washington account for 52 target seats but use top-two/open paths that do not fit v0.1's `partisan_primary_general` contract. See [`house-filing-runway-authority-proposal-2026-08-04.md`](../reviews/house-filing-runway-authority-proposal-2026-08-04.md).

## Interpretation

- The score measures target attractiveness under this strategy, not incumbent ideology and not win probability.
- AIPAC financial support is deliberately a dominant strategic signal on its route.
- A deep-blue seat can qualify without AIPAC evidence.
- AIPAC evidence cannot qualify a district whose Democratic presidential-margin floor is below 8 points.
- Every output includes formula version, selected route, component values, evidence coverage, and whether partial inference was used.
- Feasibility observations carry their own as-of date, methodology version, and release-closure snapshot IDs; post-cutoff observations are rejected.
- Open/vacant seats, special elections, non-voting seats, Senate seats, and non-Democratic incumbents require separate formulas and are outside v0.1.

## Separate campaign-readiness review

The seat score answers where structural conditions fit this targeting strategy. It does not answer whether a real campaign is ready. After a seat qualifies, a reviewer should record a separate, non-composite campaign-readiness assessment based on DSA National Electoral Commission criteria and campaign-specific evidence:

- local chapter support, leadership depth, and capacity for a sustained field operation;
- whether a prospective candidate is a DSA member with demonstrated chapter participation;
- candidate commitment to DSA's platform, organization-building, and socialist identification;
- candidate-specific fundraising, volunteer, communications, and ballot-access plans;
- local endorsements and labor/community relationships;
- whether national fundraising, publicity, phonebanking, or canvassing would materially improve the path to victory;
- credible polling or field evidence, when available, with sponsor and methodology disclosed.

These observations must not be silently imputed from the district's demographics, online popularity, or the seat score. They should be versioned reviewer inputs attached to a named prospective campaign. The product may eventually present a two-dimensional matrix—`seat target score` by `campaign readiness`—but must not add the two into a false-precision win probability.
### Priority brief projection

The public `dsa-target-priority-briefs-20260807-v1` projection converts the v0.2 ranking into 212 deterministic, source-linked briefs. The public index opens with the top 50 and can expand to all seats. Each brief explains the formula and four score drivers and adds compact member-service and district context. The ordering, universal fallback, lifecycle, and regeneration command are documented in `docs/reviews/dsa-target-priority-briefs-v1-2026-08-07.md`.
