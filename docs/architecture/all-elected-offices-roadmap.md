# All elected offices expansion roadmap

## Objective

Extend Seat / Record from the current federal catalog toward every U.S. elected office for which a defensible public record can be acquired, from federal offices through state, territorial, tribal, county, municipal, township, school-district, and special-district offices.

“Every office” is a coverage objective, not a claim that one source or one ranking formula can cover every jurisdiction. The product must publish source- and office-family coverage, preserve local source terminology, and keep unavailable offices explicit.

## Architecture boundary

The current federal release remains a bounded context with its exact 541-seat, FEC, Census, and 441-map invariants. Those checks must not be weakened to admit local records.

An additive office-universe context owns:

- hierarchical government units and jurisdictions;
- governing bodies distinct from the offices or seats that compose them;
- explicit catalog scopes such as `federal_congressional`, `state_legislative`, or a source-defined local catalog;
- source-defined and normalized office titles;
- government level and office family;
- partisan/nonpartisan status;
- election method and district magnitude;
- source natural keys and release snapshots;
- effective dates and selection method (`elected`, `appointed`, `ex_officio`, `mixed`, or `unknown`);
- formula-program eligibility and required factual inputs.

Each source adapter translates its source into the office-universe contract. Each evaluation program declares the government levels, office families, election methods, district magnitude, and factual inputs it supports. An office is matched to a formula before scoring; unsupported election systems never fall through to a federal formula.

## Why formulas must remain plural

The current DSA primary target evaluator applies only to occupied, single-member, partisan, voting U.S. House seats held by Democrats. Other office families need separate methods:

| Office/election family | Distinct considerations |
| --- | --- |
| State and local partisan legislature | Different campaign-finance systems, filing deadlines, district returns, term limits, and legislative professionalism |
| Nonpartisan mayor/executive | No same-party primary assumption; runoff and local executive power matter |
| Multimember council/board | Vote threshold, seats elected, bullet voting, staggered terms, and at-large geography matter |
| Ranked-choice/top-two/top-four | Qualification and transfer/elimination mechanics differ from a closed partisan primary |
| Judicial retention | Retention threshold and appointment history replace challenger-primary conditions |
| Prosecutor, sheriff, clerk, assessor, treasurer | Office power, incumbency, local campaign finance, and sometimes uncontested election history differ by state |
| School and special districts | Boundaries, election timing, very low information/turnout, and nonpartisan rules are highly fragmented |
| Tribal government | Sovereign election authorities and data-use rules must be handled as first-class jurisdiction policy |

The product can share factual observations and provenance while keeping formula families separate.

## Phased delivery

## Source backbone

No authoritative national feed contains every government unit, governing body, elected seat, current holder, candidate filing, and certified result. Coverage therefore combines a national discovery backbone with official office/election authorities:

| Layer | Preferred source | Role |
| --- | --- | --- |
| Federal membership and terms | Congress.gov API, House Clerk, U.S. Senate | Official federal roster and term evidence |
| Federal candidacy and finance | FEC API and bulk data | Candidate, committee, filing, contribution, and independent-expenditure evidence |
| State legislative discovery | Open States/Plural API, reconciled to official state sources | Cross-state identifiers, roles, and change detection |
| State and local elections | Secretary of State, state election board, county election authority, municipal/local clerk | Candidate filings, ballots, contest rules, canvass, certification, and corrections |
| Government-unit universe | Census Annual Government Units Listing | Counties, municipalities, townships, school districts, and special-district discovery; not proof of an elected office |
| General geography | Census TIGER/Line and Boundary and Annexation Survey | Versioned legal geography where semantically applicable |
| School-district universe | NCES Common Core of Data | Stable district/LEA identity; not board-seat or election evidence |
| Election interchange | NIST Election Results Reporting Common Data Format | Normalization vocabulary/schema when adopted by an authority; not a data feed |
| Results reconciliation | MIT Election Data and Science Lab and OpenElections | Discovery and cross-checking; official certification remains controlling |
| Optional accelerators | Democracy Works or BallotReady under an approved contract | Upcoming election and officeholder discovery when retention, derivation, display, and correction rights permit |

Government-unit discovery must never be converted directly into an elected-office row. A rare office enters the elected catalog only when a charter, statute, official ballot/filing list, election notice, or certificate establishes its selection method and identity.

### Phase A — federal target evaluation

Complete the House evaluator's missing election and AIPAC transaction inputs, run sensitivity analysis, and publish a reviewer-only ranking before changing the public surface.

### Phase B — state legislative pilot

Select two to four states with authoritative machine-readable office, district, candidate, results, filing-deadline, and campaign-finance data. Exercise partisan, nonpartisan, multimember, and term-limited cases. Do not claim national state-legislative coverage from a pilot.

### Phase C — national state-office catalog

Add governors, statewide executives, state legislators, and elected judicial/prosecutorial offices where source coverage is defensible. Publish state-by-state source and missingness matrices.

### Phase D — county and municipal pilot

Choose counties and municipalities with official open-data or election-result APIs. Add hierarchical jurisdiction IDs, local boundaries, local campaign-finance adapters, and source-title preservation.

### Phase E — school and special districts

Add school boards, water/sewer/fire/transit/park/library and other special districts only where the responsible election authority and geography can be identified. Allow catalog-only records when election or finance facts are unavailable.

Represent appointed, mixed, ex-officio, and unknown-selection bodies in discovery coverage so they are not repeatedly mistaken for missing elections. Only `elected` offices enter election scoring.

### Phase F — broad source federation

Federate official state/local sources with reviewed aggregation partners. Measure coverage by jurisdiction and office family; retain correction history and do not convert source absence into “office does not exist.”

## Migration strategy

1. Keep existing federal tables and health contracts unchanged.
2. Prove the additive domain contract with source fixtures and formula eligibility tests.
3. Introduce separate jurisdiction/office-universe persistence in a forward migration.
4. Build an anti-corruption adapter that projects federal `offices` and `seat_cycles` into the new read model without rewriting federal identities.
5. Add one source family at a time behind coverage gates.
6. Move browse/search to a union read model only after federal parity tests pass.
7. Retire duplicated federal-only read structures only after production comparison demonstrates identical federal records and routes.

## Non-negotiable data rules

- Preserve official source names and identifiers alongside normalized titles.
- Bind every record to a jurisdiction hierarchy and source snapshot.
- Distinguish “not collected,” “authority unavailable,” “office not elected,” “office abolished,” and “no election held.”
- Never assume a title uniquely identifies an office across jurisdictions.
- Never assume every office uses geographic districts, partisan primaries, plurality voting, or fixed four-year terms.
- Treat appointed/elected transitions and hybrid selection systems as versioned historical facts.
- Do not rank offices across incompatible formula families on one universal numeric scale.
