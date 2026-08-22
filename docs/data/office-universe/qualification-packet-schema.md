# Source-locked qualification packet schema

## Purpose and scope

A qualification packet is a read-only, source-locked assessment for exactly one state and one closed election cycle. It records evidence assessment, not source coverage, state selection, source configuration, acquisition, or publication readiness. A packet may conclude that zero states are qualified.

Packets never authorize configuration, acquisition, publication, scoring, or coverage claims. They are inputs to review only; a decision in a packet does not change any system configuration or public release.

## Packet metadata

Each packet must contain all of the following fields:

| Field | Requirement |
| --- | --- |
| `packetVersion` | Versioned schema identifier. |
| `state` | Exactly one state, identified by its USPS abbreviation and name. |
| `family` | Exactly `state_legislative`. |
| `cycle` | Exactly one closed election cycle, identified by year and election scope. A future or open cycle is invalid. |
| `cutoffAt` | UTC timestamp defining the latest admissible retrieval or evidence event. Evidence after this cutoff is excluded. |
| `decision` | Exactly one of `not_qualified`, `qualified_for_shadow_intake`, or `rejected`. |
| `decisionRationale` | Bounded explanation of the decision and the applicable gate evidence. |
| `reviewedSource` | Required only for `qualified_for_shadow_intake`; identifies the reviewed source and its retained evidence. |
| `gates` | Exactly the eight required gate rows below, each occurring once. |

`qualified_for_shadow_intake` means only that the packet passed the qualification gates for a manual shadow run. It does not authorize automated intake, configuration, publication, or a coverage claim. `not_qualified` is the required decision whenever advancement conditions are not all met. `rejected` records a reviewed determination that the state or cycle is unsuitable for this packet's purpose; it has no operational effect.

## Required gate rows

Each row has a stable `gate` identifier, exactly one allowed `status`, a `scope`, `omissions`, and `rationale`. The eight rows are mandatory even when evidence was not collected.

| `gate` | Required scope |
| --- | --- |
| `office_district_universe` | State-legislative offices and districts in the closed cycle. |
| `filing` | Filing rules, periods, and ballot-access requirements for that universe. |
| `results_certification` | Results and applicable certification authority for the closed cycle. |
| `calendar` | Election dates and legally relevant deadlines for the closed cycle. |
| `finance` | State-legislative finance authority, availability, and cycle scope. |
| `geography` | District geography and the applicable plan or boundary authority. |
| `election_system_diversity` | Election-system rules or variations that affect defensible modeling. |
| `missingness` | Known missing, unavailable, unresolved, and excluded evidence across the other seven gates. |

The `missingness` row cannot replace an omitted required row or convert missing evidence into a complete or zero-valued observation.

## Gate status and evidence invariants

The only permitted status values are `retained`, `not_collected`, `source_unavailable`, `not_defensibly_modeled`, `blocked_by_retention`, and `quarantined`.

Every gate row must include `status`, `scope`, `omissions`, and `rationale`. `scope` states the exact state, cycle, offices, districts, and facts assessed. `omissions` lists known exclusions; use an explicit empty value only when there are none. `rationale` explains the status without asserting facts beyond the retained evidence.

`retained` additionally requires all of the following nonempty evidence fields:

| Field | Requirement |
| --- | --- |
| `authority` | Named issuing authority or official source. |
| `url` | HTTPS source URL. |
| `retainedPath` | Repository-relative retained artifact path. |
| `sha256` | Lowercase SHA-256 hash of the retained artifact. |
| `retrievedAt` | UTC retrieval timestamp at or before `cutoffAt`. |
| `retentionBasis` | Why the artifact may be retained and used for this bounded assessment. |
| `scope` | Exact evidence scope, as required for every row. |
| `omissions` | Exact known exclusions, as required for every row. |
| `rationale` | Why the retained evidence satisfies this gate's bounded assessment. |

For every non-`retained` status, retained-evidence fields (`authority`, `url`, `retainedPath`, `sha256`, `retrievedAt`, and `retentionBasis`) must be absent. Its rationale must state the specific limitation:

| Status | Required meaning |
| --- | --- |
| `not_collected` | No collection attempt or review has established the evidence. |
| `source_unavailable` | A reviewed source needed for the scope could not be obtained; record the attempted source and reason in the rationale. |
| `not_defensibly_modeled` | Available evidence exists but cannot support the required bounded model without unsupported inference. |
| `blocked_by_retention` | Evidence may have been identified, but retention or permitted use prevents a retained, reviewable packet record. |
| `quarantined` | Evidence or its acquisition path is unsafe, malformed, contradictory, or otherwise excluded pending resolution. |

No status implies a zero, complete, certified, approved, configured, or publishable result. A quarantine is systemic when it affects the packet's source, cycle, or more than one gate; it must be named in the affected gate rationales and the packet decision rationale.

## Advancement rule

Set `decision` to `qualified_for_shadow_intake` only when all of these conditions hold:

1. The packet has exactly one valid state, `family: state_legislative`, one closed cycle, and a UTC cutoff.
2. Each of the eight required gate rows exists exactly once and has status `retained` with all required retained-evidence fields.
3. No systemic quarantine remains.
4. At least one reviewed source is identified and its retained evidence is bound to the packet.
5. The retained artifacts can be replayed from their paths and SHA-256 values.
6. A manual shadow run against this exact packet has succeeded and is recorded in `decisionRationale` with its date and reviewer.

Any unmet condition requires `not_qualified`, unless a reviewed rejection is explicitly recorded as `rejected`. Neither outcome permits configuration, acquisition, publication, or coverage claims.
