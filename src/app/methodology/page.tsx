import Link from "next/link";
import { loadMethodologyPage } from "@/ui/server-data";
import { Shell, RouteState, fmtDate } from "@/components/presentational";
import { housePriorityBriefs } from "@/lib/house-priority-index";
import { loadRapidExpansionStatus } from "@/ui/rapid-expansion-status";

export const dynamic = "force-dynamic";

export default async function Methodology() {
  const [result, expansionStatus] = await Promise.all([loadMethodologyPage(), loadRapidExpansionStatus()]);
  if (!result.ok) return <RouteState code={result.code} />;
  const { value: page } = result;
  const rows = housePriorityBriefs();
  const democrats = rows.filter((row) => row.incumbentParty === "Democratic");
  const republicans = rows.filter((row) => row.incumbentParty === "Republican");
  const covered = (key: string, candidates = rows) => candidates.filter((row) => row.scoreDrivers.some((driver) => driver.key === key && driver.score !== null)).length;

  return <Shell release={page.release}><main className="page method-page">
    <p className="eyebrow">METHOD / {page.release.label}</p><h1>How the Priority Index works</h1>
    <p className="lede">The score is a comparative research index from 0–100. It helps order where investigation may be most useful; it is not a win probability, polling estimate, endorsement, or prediction. Source cutoff: {fmtDate(page.release.sourceCutoff)}.</p>

    <section className="method-principles">
      <article><b>Higher means</b><p>More structural or political reason to investigate the seat as an organizing opportunity.</p></article>
      <article><b>Missing means missing</b><p>An unavailable component is omitted and the remaining weights are renormalized. Missing never becomes zero.</p></article>
      <article><b>Two distinct routes</b><p>Democratic primary opportunities and Republican-held general-election fringes use different formulas.</p></article>
    </section>

    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">WEIGHT MATRIX</p><h2>What changes the final score</h2></div><p>Weights apply only inside the relevant party route. AIPAC support and primary feasibility help select the Democratic structural baseline; they are not added again afterward.</p></div>
      <div className="table-wrap method-weight-table" role="region" tabIndex={0} aria-label="Priority Index weight matrix"><table><thead><tr><th>Component</th><th>Democratic-held seat</th><th>Republican-held seat</th><th>Meaning</th></tr></thead><tbody>
        <tr><td><strong>Structural opportunity</strong></td><td>65% of final score</td><td>—</td><td>Stronger of the deep-blue and AIPAC-supported blue routes.</td></tr>
        <tr><td><strong>Incumbent alignment gap</strong></td><td>20% of final score</td><td>—</td><td>Distance from full alignment on the retained issue trackers.</td></tr>
        <tr><td><strong>Cash vulnerability</strong></td><td>15% of final score</td><td>25% of pre-cap route</td><td>Lower incumbent cash produces a higher vulnerability score.</td></tr>
        <tr><td><strong>Local context</strong></td><td>20% of structural baseline when exact</td><td>20% of pre-cap route when exact</td><td>Turnout, registration, and demographics for complete at-large county joins only.</td></tr>
        <tr><td><strong>General-election competitiveness</strong></td><td>—</td><td>75% of pre-cap route</td><td>Closeness of the district&apos;s retained 2024 presidential result.</td></tr>
        <tr><td><strong>Republican route cap</strong></td><td>—</td><td>70% multiplier</td><td>Keeps this screening route distinct from evidence-rich primary opportunities.</td></tr>
      </tbody></table></div>
    </section>

    <section className="record-section"><p className="eyebrow">DEMOCRATIC-HELD SEATS</p><h2>Primary-opportunity model</h2><p>The Democratic field starts with the stronger available structural route, then adds incumbent alignment and campaign-finance vulnerability.</p>
      <div className="method-grid"><article><h3>Deep-blue route</h3><code>0.70 × blue baseline + 0.30 × primary feasibility</code><p>Rewards safe Democratic districts where the retained primary evidence indicates a challenge may be structurally plausible.</p></article><article><h3>AIPAC-supported blue route</h3><code>0.60 × AIPAC support + 0.25 × blue baseline + 0.15 × primary feasibility</code><p>Available only when retained numeric AIPAC evidence exists. The higher available structural route becomes the baseline.</p></article></div>
      <div className="formula-block"><span>Exact-context structural baseline</span><code>0.80 × prior structural baseline + 0.20 × local context</code><span>Final Democratic score</span><code>0.65 × structural baseline + 0.20 × alignment gap + 0.15 × cash vulnerability</code></div>
    </section>

    <section className="record-section"><p className="eyebrow">REPUBLICAN-HELD SEATS</p><h2>General-election fringe model</h2><p>Republican seats combine district competitiveness with incumbent cash vulnerability. They do not receive invented Democratic-primary, AIPAC, or Democratic-incumbent alignment values.</p>
      <div className="formula-block"><span>District competitiveness</span><code>clamp(100 − 4 × max(0, Republican margin), 0, 100)</code><span>Standard pre-cap route</span><code>0.75 × competitiveness + 0.25 × cash vulnerability</code><span>Exact-context pre-cap route</span><code>0.60 × competitiveness + 0.20 × cash vulnerability + 0.20 × local context</code><span>Final Republican score</span><code>0.70 × pre-cap route</code></div>
      <p>The route tops out at 70. That allows genuinely competitive, financially vulnerable Republican incumbents to rise without treating a general-election screen as equivalent to the Democratic primary model.</p>
    </section>

    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">COMPONENT DICTIONARY</p><h2>What every number represents</h2></div><p>Every component is expressed on a 0–100 scale. A high component always increases priority; it does not necessarily mean the underlying raw value is high.</p></div><div className="component-table">
      <MethodComponent title="Blue baseline" meta="0–100 · structural" copy="District Democratic strength derived from the retained 2024 presidential result. Higher values indicate a safer Democratic baseline." />
      <MethodComponent title="Primary feasibility" meta="0–100 · contest evidence" copy="For 21 exact 2024 incumbent links, this is 100 minus the incumbent's share of all retained Democratic-primary contest votes. Other seats retain the earlier partial estimate; RI-01 remains unresolved. It is not a challenger forecast or winner claim." />
      <MethodComponent title="AIPAC support" meta="0–100 · FEC evidence" copy="Numeric retained evidence connected to the AIPAC network. Tracker labels may add context, but are not counted a second time." />
      <MethodComponent title="Incumbent alignment gap" meta="0–100 · voting-record gap" copy="Distance between retained Left and Palestine tracker scores and full alignment. Available trackers are normalized and partial coverage receives a missingness penalty." />
      <MethodComponent title="Cash vulnerability" meta="0–100 · FEC finance" copy="An inverse logarithmic cash-on-hand scale. It measures the incumbent's financial vulnerability, not challenger fundraising strength." />
      <MethodComponent title="General-election competitiveness" meta="0–100 · Republican route" copy="Closeness of a Republican-held district using the 2024 presidential result. A tied district starts at 100; every Republican margin point subtracts four." />
      <MethodComponent title="Local context" meta="0–100 · exact county joins" copy="An available-weight blend of inverse turnout/CVAP, inverse registration/CVAP, down-ballot overperformance, and demographic opportunity. DE-AL, SD-AL, and WY-AL have all weights; ND-AL has 70% and renormalizes the available weights." />
    </div></section>

    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">CASH SCALE</p><h2>Why the finance curve is logarithmic</h2></div><p>Campaign cash spans orders of magnitude. A logarithmic curve prevents one very large account from flattening meaningful differences among lower-cash incumbents.</p></div>
      <div className="formula-block"><span>Cash vulnerability</span><code>100 × (1 − log(cash ÷ $50,000) ÷ log(100))</code><small>Clamped to 100 at $50,000 or less and 0 at $5 million or more.</small></div>
      <div className="cash-anchors" aria-label="Cash vulnerability scale anchors"><article><strong>$50K</strong><span>100</span><small>Most vulnerable anchor</small></article><article><strong>$500K</strong><span>50</span><small>Midpoint</small></article><article><strong>$5M</strong><span>0</span><small>Least vulnerable anchor</small></article></div>
    </section>

    <section className="record-section"><p className="eyebrow">MISSING DATA</p><h2>Omission, not punishment</h2><p>If cash is not reported, its weight is removed and available inputs are renormalized. The three affected seats are not assigned a zero cash score.</p>
      <div className="method-grid"><article><h3>Democratic seat without cash</h3><code>(0.65 × baseline + 0.20 × alignment) ÷ 0.85</code><p>Preserves the ratio between structural and alignment evidence.</p></article><article><h3>Republican seat without cash</h3><code>0.70 × competitiveness</code><p>Uses the available general-election signal, still subject to the route cap.</p></article></div>
      <ul><li>Missing AIPAC evidence makes that structural route unavailable; it does not produce an AIPAC score of zero.</li><li>Non-applicable components are shown as an em dash on the opposite party route.</li><li>Receipts and disbursements remain context only and are not substitutes for missing cash.</li></ul>
    </section>

    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">ACTIVE V0.8</p><h2>Direct primary evidence with identity and geography gates</h2></div><p>The public rank uses v0.8. It activates a 2024 primary component only when the retained candidate name is linked to the current incumbent and the contest district is the same CD119 key. The metric is <code>100 − incumbent vote share</code>; source winner markers never drive the calculation.</p></div>
      <div className="method-grid"><article><h3>Primary identity gate</h3><code>current House identity + retained candidate-name evidence</code><p>Nineteen rows use exact normalized names and two use documented name relationships. RI-01 remains inactive because Gabriel and Gabe are not bridged by the retained authorities.</p></article><article><h3>Primary geography gate</h3><code>2024 contest session 119 + exact district key</code><p>No historical crosswalk or same-number assumption is used. The 21 admitted rows then replace, rather than stack on top of, the earlier inferred primary component.</p></article></div>
      <p>{expansionStatus ? `Current active closure: ${expansionStatus.score.directPrimaryActiveSeats} direct primary rows, ${expansionStatus.score.unresolvedPrimaryRows} retained unresolved row, and ${expansionStatus.score.unchangedSeats} seats unchanged from v0.7.` : "The generated v0.8 activation receipt is unavailable."}</p>
    </section>

    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">LOCAL CONTEXT</p><h2>County context with an exact-geography gate</h2></div><p>Four complete at-large county universes add a House-versus-presidential component only where every county closes against the current Census universe. A local score requires at least 60% of the component weight and a direct turnout or registration measure.</p></div>
      <div className="method-grid"><article><h3>Demographic opportunity</h3><code>.35 renter + .25 age 18–34 + .25 inverse income + .15 density</code><p>Each county measure becomes a within-state midrank percentile, then county percentiles are population-weighted into an exact district geography.</p></article><article><h3>Local context</h3><code>.40 inverse ballots/CVAP + .30 inverse registration/CVAP + .20 down-ballot overperformance + .10 demographics</code><p>Down-ballot overperformance is <code>clamp(50 + 5 × (House D share − Harris share), 0, 100)</code>. House share counts candidate votes, including write-ins, and excludes overvotes and undervotes.</p></article></div>
      <div className="formula-block"><span>Expanded structural score</span><code>.80 × current structural + .20 × local context</code><small>Only exact at-large or whole-county CD119 joins may qualify. Split counties remain unavailable until an authoritative allocation is retained.</small></div>
      <p>{expansionStatus ? `Current local-context closure: ${expansionStatus.score.localContextActiveSeats} seats have local context, and all ${expansionStatus.score.downBallotActiveSeats} (${expansionStatus.score.activeDistricts.map((row) => row.districtLabel).join(", ")}) have the House comparison. ND-AL is the one partial-component activation.` : "The generated activation receipt is unavailable."}</p>
      <p>South Dakota uses one bounded identifier correction: the source already labels the county Oglala Lakota but carries obsolete FIPS 46113. The Census Bureau states that Shannon County (46-113) changed name and code to Oglala Lakota County (46-102) effective May 1, 2015. V0.6 applied only that documented substitution; v0.7 preserves it unchanged.</p>
      <p>North Dakota has complete 2024 ballots and CVAP values for all 53 counties, complete county demographics, and a complete at-large House comparison. Active-registration values are unavailable in the retained EAVS rows, so that 30% subweight is omitted—not set to zero—and the available 70% is renormalized. The resulting local-context value is 63.3.</p>
    </section>

    <section className="record-section"><p className="eyebrow">WORKED EXAMPLES</p><h2>Two hypothetical seats</h2><div className="worked-examples"><article><span>Democratic-held</span><h3>Baseline 80 · alignment 60 · cash 40</h3><code>(.65 × 80) + (.20 × 60) + (.15 × 40) = 70.0</code><p>A solid structural opportunity with a moderate alignment gap and stronger incumbent finances.</p></article><article><span>Republican-held</span><h3>Competitiveness 80 · cash 60</h3><code>.70 × ((.75 × 80) + (.25 × 60)) = 52.5</code><p>A competitive fringe seat that remains below the Republican-route ceiling.</p></article></div></section>

    <section className="record-section"><p className="eyebrow">READING THE RESULT</p><h2>Score bands are triage labels</h2><div className="score-bands"><article><strong>80–100</strong><span>Investigate first</span></article><article><strong>60–79.9</strong><span>Strong case</span></article><article><strong>40–59.9</strong><span>Watchlist</span></article><article><strong>0–39.9</strong><span>Lower relative priority</span></article></div><p>These bands help read a long ranked list. They are not calibrated probabilities, quality grades, endorsement thresholds, or promises of electoral viability.</p></section>

    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">CURRENT MODEL COVERAGE</p><h2>The denominator behind the method</h2></div><p>These counts are calculated from the same records displayed by the Priority Index.</p></div><div className="method-coverage"><article><strong>{rows.length}</strong><span>ranked seats</span></article><article><strong>{democrats.length}</strong><span>Democratic seats</span></article><article><strong>{republicans.length}</strong><span>Republican seats</span></article><article><strong>{covered("cash_vulnerability")}</strong><span>cash values</span></article><article><strong>{covered("aipac_support", democrats)}</strong><span>numeric AIPAC values</span></article><article><strong>{covered("incumbent_alignment_gap", democrats)}</strong><span>alignment values</span></article></div></section>

    <section className="record-section"><p className="eyebrow">LIMITS & DATA DISCIPLINE</p><h2>What the index still does not know</h2><ul><li>It does not yet model challenger cash, candidate quality, endorsements, polling, race ratings, field capacity, or local organizing strength.</li><li>Historical primary coverage is not complete in every state and cycle. The rapid ledger is separately reported on the Sources page; only 21 identity- and geography-gated 2024 rows enter v0.8.</li><li>County demographics, registration, and turnout affect the active score only for DE-AL, ND-AL, SD-AL, and WY-AL. Split-county seats remain unchanged until an authoritative allocation is retained.</li><li>The 2024 county House projection is a research fallback. It is used only where the entire current at-large county universe and candidate denominator close exactly; it remains excluded everywhere else.</li><li>ND-AL has no retained active-registration value. The score visibly reports 70% local evidence coverage and does not impute the missing 30% subweight.</li><li>State-legislative and county-office pilots are separate catalogs and never flow into the House rank.</li><li>Election results retain their reported certification and completeness boundaries; missing values remain labeled.</li><li>Scores are rounded to one decimal and sorted descending, then by stable seat identifier for deterministic ties.</li></ul><p><Link href="/sources">Open the Sources page</Link> for score-input coverage, retained snapshot lineage, and explicit missing reasons.</p></section>
  </main></Shell>;
}

function MethodComponent({ title, meta, copy }: { title: string; meta: string; copy: string }) {
  return <article><h3>{title}</h3><b>{meta}</b><p>{copy}</p></article>;
}
