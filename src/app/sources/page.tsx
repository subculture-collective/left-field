import Link from "next/link";
import { loadSourcesPage } from "@/ui/server-data";
import type { SourcesPageViewModel } from "@/ui/view-models";
import { Shell, RouteState, Status, fmtDate, words } from "@/components/presentational";
import { housePriorityBriefs } from "@/lib/house-priority-index";
import { loadRapidHousePrimaryCoverage } from "@/ui/rapid-house-primary-coverage";
import { loadRapidLocalContextCoverage } from "@/ui/rapid-local-context-coverage";
import { loadRapidExpansionStatus } from "@/ui/rapid-expansion-status";

export const dynamic = "force-dynamic";
type Coverage = SourcesPageViewModel["coverage"][number];

export default async function Sources() {
  const [result, rapidCoverage, localContextCoverage, expansionStatus] = await Promise.all([loadSourcesPage(), loadRapidHousePrimaryCoverage(), loadRapidLocalContextCoverage(), loadRapidExpansionStatus()]);
  if (!result.ok) return <RouteState code={result.code} />;
  const { value: page } = result;
  const indexRows = housePriorityBriefs();
  const driverCoverage = (key: string) => indexRows.filter((row) => {
    const driver = row.scoreDrivers.find((candidate) => candidate.key === key);
    return driver && driver.score !== null;
  }).length;
  const democraticSeats = indexRows.filter((row) => row.incumbentParty === "Democratic").length;
  const republicanSeats = indexRows.filter((row) => row.incumbentParty === "Republican").length;
  const groups = [...new Set(page.coverage.map((row) => row.domain))].sort().map((domain) => ({ domain, rows: page.coverage.filter((row) => row.domain === domain) }));
  return <Shell release={page.release}><main className="page sources-page">
    <p className="eyebrow">SOURCE LEDGER</p><h1>What we have, and what we do not.</h1>
    <p className="lede">Start with the six inputs that affect the public ranking. The broader release ledger and exact retained snapshots remain available below for audit.</p>
    <section className="source-scorecard" aria-label="Priority Index source coverage">
      <article><span>Ranked universe</span><strong>{indexRows.length}</strong><p>{democraticSeats} Democratic · {republicanSeats} Republican</p></article>
      <article><span>Cash on hand</span><strong>{driverCoverage("cash_vulnerability")} / {indexRows.length}</strong><p>Three explicit not-reported outcomes</p></article>
      <article><span>Source cutoff</span><strong>{fmtDate(page.release.sourceCutoff)}</strong><p>Published release facts, not live feeds</p></article>
    </section>
    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">WHAT FEEDS THE SCORE</p><h2>Six inputs, two routes</h2></div><p>Coverage means a usable numeric component is present. It does not mean every desirable historical or challenger-level field has been collected.</p></div>
      <div className="source-input-grid">
        <SourceInput title="District partisanship" coverage={`${indexRows.length} / ${indexRows.length}`} source="Retained 2024 presidential district results" use="Creates the Democratic blue baseline and Republican general-election competitiveness." />
        <SourceInput title="Primary feasibility" coverage={`${driverCoverage("primary_feasibility")} / ${democraticSeats}`} source="Published election facts and retained primary evidence" use="Used only for Democratic-held seats; nationwide history remains uneven." />
        <SourceInput title="AIPAC support" coverage={`${driverCoverage("aipac_support")} / ${democraticSeats}`} source="FEC-derived AIPAC-network evidence" use="Used only on the Democratic AIPAC-supported route; unavailable values stay missing." />
        <SourceInput title="Incumbent alignment" coverage={`${driverCoverage("incumbent_alignment_gap")} / ${democraticSeats}`} source="119th House Left and Palestine trackers" use="Used only for Democratic incumbents; 210 are full and two are partial observations." />
        <SourceInput title="Cash vulnerability" coverage={`${driverCoverage("cash_vulnerability")} / ${indexRows.length}`} source="Latest published incumbent FEC finance aggregate" use="Affects both routes. MD-04, NY-04, and TX-03 remain not reported." />
        <SourceInput title="Local context" coverage={`${driverCoverage("local_context")} / ${indexRows.length}`} source="County CVAP, turnout, registration, demographics, and exact CD119 at-large geography" use="Active in v0.4 for DE-AL, SD-AL, and WY-AL only; every split-county seat preserves its prior score." />
        <SourceInput title="Member and service history" coverage={`${indexRows.length} / ${indexRows.length}`} source="House Clerk and Congress Legislators" use="Provides identity, biography, and tenure context; it does not independently change rank." />
      </div>
      <p className="source-method-link"><Link href="/methodology">See every weight, formula, and missing-data rule →</Link></p>
    </section>
    <section className="record-section"><p className="eyebrow">INDEX FINANCE PROJECTION</p><h2>One published finance row per ranked seat</h2><p>The index projects the latest incumbent finance aggregate from <code>rel_full_20260804_v2</code> onto the 430-seat ranking. Cash changes the score; receipts and disbursements are displayed as context and do not receive separate weights.</p><div className="source-projection-facts"><span><b>427</b> cash values</span><span><b>3</b> not reported</span><span><b>cf00b2bcfaf0…</b> projection</span><span><b>a908273c32fe…</b> retained file</span></div></section>
    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">RELEASE COVERAGE</p><h2>Open a domain for exact scopes</h2></div><p>These are factual-release coverage records, not score weights. Counts inside different scopes should not be added together as if they shared one denominator.</p></div>
    <section className="coverage-overview" aria-label="Coverage overview">
      {groups.map(({ domain, rows }) => <CoverageGroup key={domain} domain={domain} rows={rows} />)}
    </section>
    </section>
    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">RAPID ACQUISITION</p><h2>Rapid House-primary acquisition</h2></div><p>This separate, file-backed workstream is not part of the released coverage ledger and does not affect the Priority Index.</p></div>
      {!rapidCoverage ? <p className="muted">No generated rapid House-primary coverage ledger is available yet.</p> : <details className="coverage-group"><summary><span><strong>{rapidCoverage.rows.length} state-cycle scopes</strong><small>Retained source files and parsing progress</small></span><span><b>{rapidCoverage.rows.reduce((count, row) => count + row.parsedDistrictCount, 0)} parsed contests · {rapidCoverage.rows.reduce((count, row) => count + row.sourceAbsentDistrictCount, 0)} source absent</b><small>Separate from released coverage and score</small></span></summary><div className="ledger-body"><div className="table-wrap" role="region" tabIndex={0} aria-label="Rapid House-primary acquisition coverage"><table><thead><tr><th>Scope</th><th>Status</th><th>Parsed / target districts</th><th>Retained artifacts</th><th>Missing or blocked</th></tr></thead><tbody>{rapidCoverage.rows.map((row) => <tr key={`${row.stateCode}-${row.cycleYear}`}><td><strong>{row.stateCode} · {row.cycleYear}</strong></td><td><Status>{words(row.status)}</Status></td><td>Parsed {row.parsedDistrictCount} / {row.expectedTargetDistricts.length}{row.sourceAbsentDistrictCount ? `; source absent ${row.sourceAbsentDistrictCount}` : ""}</td><td>{row.retainedArtifactCount}</td><td>{row.missingByReason?.length ? row.missingByReason.map((item) => `${words(item.reason)}: ${item.count}`).join("; ") : "Not recorded"}</td></tr>)}</tbody></table></div></div></details>}
    </section>
    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">LOCAL CONTEXT INTAKE</p><h2>Broad intake with a narrow active adapter</h2></div><p>These retained county and state-legislative inputs are independently hash-verified. Only the exact at-large county subset described below affects the Priority Index; the broader research and office catalogs remain separate.</p></div>
      {!localContextCoverage ? <p className="muted">No generated rapid local-context coverage receipt is available yet.</p> : <details className="coverage-group"><summary><span><strong>{localContextCoverage.artifacts.length} retained context sets</strong><small>County demographics, election administration, 2022/2024 House and 2024 Senate context, and a state-legislative pilot</small></span><span><b>0 score-eligible rows</b><small>Separate from released coverage and score</small></span></summary><div className="ledger-body"><div className="table-wrap" role="region" tabIndex={0} aria-label="Rapid local context acquisition coverage"><table><thead><tr><th>Context set</th><th>Scope</th><th>Coverage</th><th>Score use</th></tr></thead><tbody>{localContextCoverage.artifacts.map((artifact) => <tr key={artifact.id}><td><strong>{artifact.label}</strong><small><code>{artifact.id}</code></small></td><td>{artifact.scope}</td><td>{Object.entries(artifact.summary).map(([key, value]) => `${words(key)}: ${value}`).join(" · ")}</td><td>Excluded — {artifact.formulaEligibleCount} eligible rows</td></tr>)}</tbody></table></div></div></details>}
    </section>
    <section className="record-section"><div className="section-heading-pair"><div><p className="eyebrow">ACTIVE V0.4 & LOCAL PILOT</p><h2>Exact county context is now in the score</h2></div><p>V0.4 uses county CVAP, turnout, registration, and demographics only where the complete at-large state joins exactly. County-office results remain a separate catalog.</p></div>
      {!expansionStatus ? <p className="muted">The retained v0.4 activation receipt is unavailable.</p> : <div className="source-input-grid"><article><div><h3>House {expansionStatus.score.version}</h3><strong>{expansionStatus.score.localContextActiveSeats} / {expansionStatus.score.seats}</strong></div><p>{expansionStatus.score.activeDistricts.map((row) => `${row.districtLabel} ${row.previousScore.toFixed(1)}→${row.activeScore.toFixed(1)}`).join(" · ")}</p><small>Three exact at-large seats use local context; {expansionStatus.score.unchangedSeats} seats preserve v0.3 exactly. No split-county allocation or research-fallback election result enters the score.</small></article><article><div><h3>Indiana county commissioners</h3><strong>{expansionStatus.countyOffice.partyContests} contests</strong></div><p>{expansionStatus.countyOffice.officeRows} office rows · {expansionStatus.countyOffice.exactCountyOfficeRows} exact county-name joins · {expansionStatus.countyOffice.unmappedOfficeRows} irregular titles retained unmapped</p><small>Catalog only: current-holder identity and a county-office scoring method are not collected.</small></article></div>}
    </section>
    <section className="record-section"><p className="eyebrow">SOURCE INVENTORY</p><h2>Publishers and retained snapshots</h2><p className="muted">{page.snapshotScope}</p>
      <div className="source-disclosures">{page.sources.map(({ source, snapshots }) => <details className="ledger-disclosure" key={String(source.id)}><summary><span><strong>{source.name}</strong><small>{source.id}</small></span><span><Status>{source.authority}</Status><b>{snapshots.length} {snapshots.length === 1 ? "snapshot" : "snapshots"}</b></span></summary><div className="ledger-body"><p><a href={source.homepageUrl}>Open publisher homepage ↗</a></p>{snapshots.length === 0 ? <p className="empty-copy">No snapshots fall within this page closure.</p> : <div className="table-wrap" role="region" tabIndex={0} aria-label={`${source.name} snapshots`}><table><thead><tr><th>Snapshot</th><th>Dates</th><th>License / usage</th><th>Checksum / parser</th></tr></thead><tbody>{snapshots.map((snapshot) => <tr key={String(snapshot.id)}><td><a href={snapshot.sourceUrl}>{snapshot.id}</a></td><td>Published: {fmtDate(snapshot.publishedAt)}<small>Retrieved: {fmtDate(snapshot.retrievedAt)}</small></td><td>{snapshot.license}<small><Status>{snapshot.usageStatus}</Status></small></td><td><code>{snapshot.checksumSha256.slice(0, 12)}…</code><small>{snapshot.parserVersion}</small></td></tr>)}</tbody></table></div>}</div></details>)}</div>
    </section>
  </main></Shell>;
}

function SourceInput({ title, coverage, source, use }: { title: string; coverage: string; source: string; use: string }) {
  return <article><div><h3>{title}</h3><strong>{coverage}</strong></div><p>{source}</p><small>{use}</small></article>;
}

function CoverageGroup({ domain, rows }: { domain: string; rows: readonly Coverage[] }) {
  const incomplete = rows.filter((row) => row.observedCount < row.expectedCount || row.status !== "complete").length;
  return <details className="coverage-group"><summary><span><strong>{coverageTitle(domain)}</strong><small>{coverageDescription(domain)}</small></span><span><b>{rows.length} {rows.length === 1 ? "scope" : "scopes"}</b><small>{incomplete ? `${incomplete} need attention` : "all listed scopes complete"}</small></span></summary><div className="ledger-body"><div className="table-wrap" role="region" tabIndex={0} aria-label={`${domain} coverage details`}><table><thead><tr><th>Scope</th><th>Status</th><th>Observed / expected</th><th>Unavailable or incompatible</th><th>Evidence</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.domain}-${scopeKey(row.scope)}-${row.status}`}><td><strong>{scopeLabel(row.scope)}</strong><small>{row.recordCount} ledger {row.recordCount === 1 ? "record" : "records"}</small></td><td><Status>{row.status}</Status></td><td>{row.observedCount} / {row.expectedCount}</td><td>{row.missingByReason.length ? row.missingByReason.map((item) => `${words(item.reason)}: ${item.count}`).join("; ") : "None recorded"}<small>Quarantined {row.quarantinedCount} · incompatible {row.incompatibleCount}</small></td><td>{row.inputSnapshotCount} input {row.inputSnapshotCount === 1 ? "snapshot" : "snapshots"}</td></tr>)}</tbody></table></div></div></details>;
}

const coverageTitle = (domain: string) => ({ acs: "District demographics", election: "Election results", finance: "Campaign finance", geography: "District geography", identity: "Member identity", maps: "District maps", member: "Member records" } as Record<string, string>)[domain] ?? words(domain);
const coverageDescription = (domain: string) => ({ acs: "Census estimates and margins of error", election: "Cycle-by-cycle reported result coverage", finance: "FEC and categorized funding records", geography: "Seat-to-district geographic closure", identity: "Current officeholder links", maps: "Renderable district boundaries", member: "Biographical and service facts" } as Record<string, string>)[domain] ?? "Published release coverage";
type CoverageScope = Coverage["scope"];
function scopeLabel(scope: CoverageScope) { if (scope.kind === "release") return "Release-wide"; if (scope.kind === "jurisdiction") return "Jurisdiction-wide"; if (scope.kind === "seat_cycle") return "Seat-cycle-wide"; if (scope.kind === "acs_indicator") return `${scope.variable} · ${scope.surveyPeriod}`; if (scope.kind === "election") return `${scope.electionYear} election`; return `${words(scope.fundingKind)} funding`; }
function scopeKey(scope: CoverageScope) { return scope.kind === "acs_indicator" ? `${scope.kind}:${scope.variable}:${scope.surveyPeriod}` : scope.kind === "election" ? `${scope.kind}:${scope.electionYear}` : scope.kind === "funding" ? `${scope.kind}:${scope.fundingKind}` : scope.kind; }
