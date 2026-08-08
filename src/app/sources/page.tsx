import { loadSourcesPage } from "@/ui/server-data";
import type { SourcesPageViewModel } from "@/ui/view-models";
import { Shell, RouteState, Status, fmtDate, words } from "@/components/presentational";

export const dynamic = "force-dynamic";
type Coverage = SourcesPageViewModel["coverage"][number];

export default async function Sources() {
  const result = await loadSourcesPage();
  if (!result.ok) return <RouteState code={result.code} />;
  const { value: page } = result;
  const groups = [...new Set(page.coverage.map((row) => row.domain))].sort().map((domain) => ({ domain, rows: page.coverage.filter((row) => row.domain === domain) }));
  return <Shell release={page.release}><main className="page sources-page">
    <p className="eyebrow">SOURCE LEDGER</p><h1>What we have, and what we do not.</h1>
    <p className="lede">Coverage is grouped into plain-language sections. Open a section for its exact scopes, missing reasons, snapshots, checksums, and parsers.</p>
    <section className="coverage-overview" aria-label="Coverage overview">
      {groups.map(({ domain, rows }) => <CoverageGroup key={domain} domain={domain} rows={rows} />)}
    </section>
    <section className="record-section"><p className="eyebrow">SOURCE INVENTORY</p><h2>Publishers and retained snapshots</h2><p className="muted">{page.snapshotScope}</p>
      <div className="source-disclosures">{page.sources.map(({ source, snapshots }) => <details className="ledger-disclosure" key={String(source.id)}><summary><span><strong>{source.name}</strong><small>{source.id}</small></span><span><Status>{source.authority}</Status><b>{snapshots.length} {snapshots.length === 1 ? "snapshot" : "snapshots"}</b></span></summary><div className="ledger-body"><p><a href={source.homepageUrl}>Open publisher homepage ↗</a></p>{snapshots.length === 0 ? <p className="empty-copy">No snapshots fall within this page closure.</p> : <div className="table-wrap" role="region" tabIndex={0} aria-label={`${source.name} snapshots`}><table><thead><tr><th>Snapshot</th><th>Dates</th><th>License / usage</th><th>Checksum / parser</th></tr></thead><tbody>{snapshots.map((snapshot) => <tr key={String(snapshot.id)}><td><a href={snapshot.sourceUrl}>{snapshot.id}</a></td><td>Published: {fmtDate(snapshot.publishedAt)}<small>Retrieved: {fmtDate(snapshot.retrievedAt)}</small></td><td>{snapshot.license}<small><Status>{snapshot.usageStatus}</Status></small></td><td><code>{snapshot.checksumSha256.slice(0, 12)}…</code><small>{snapshot.parserVersion}</small></td></tr>)}</tbody></table></div>}</div></details>)}</div>
    </section>
  </main></Shell>;
}

function CoverageGroup({ domain, rows }: { domain: string; rows: readonly Coverage[] }) {
  const observed = rows.reduce((sum, row) => sum + row.observedCount, 0), expected = rows.reduce((sum, row) => sum + row.expectedCount, 0);
  const incomplete = rows.filter((row) => row.observedCount < row.expectedCount || row.status !== "complete").length;
  return <details className="coverage-group"><summary><span><strong>{coverageTitle(domain)}</strong><small>{coverageDescription(domain)}</small></span><span><b>{observed.toLocaleString()} / {expected.toLocaleString()}</b><small>{incomplete ? `${incomplete} scope${incomplete === 1 ? "" : "s"} need attention` : "complete in every listed scope"}</small></span></summary><div className="ledger-body"><div className="table-wrap" role="region" tabIndex={0} aria-label={`${domain} coverage details`}><table><thead><tr><th>Scope</th><th>Status</th><th>Observed / expected</th><th>Unavailable or incompatible</th><th>Evidence</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.domain}-${scopeKey(row.scope)}-${row.status}`}><td><strong>{scopeLabel(row.scope)}</strong><small>{row.recordCount} ledger {row.recordCount === 1 ? "record" : "records"}</small></td><td><Status>{row.status}</Status></td><td>{row.observedCount} / {row.expectedCount}</td><td>{row.missingByReason.length ? row.missingByReason.map((item) => `${words(item.reason)}: ${item.count}`).join("; ") : "None recorded"}<small>Quarantined {row.quarantinedCount} · incompatible {row.incompatibleCount}</small></td><td>{row.inputSnapshotCount} input {row.inputSnapshotCount === 1 ? "snapshot" : "snapshots"}</td></tr>)}</tbody></table></div></div></details>;
}

const coverageTitle = (domain: string) => ({ acs: "District demographics", election: "Election results", finance: "Campaign finance", geography: "District geography", identity: "Member identity", maps: "District maps", member: "Member records" } as Record<string, string>)[domain] ?? words(domain);
const coverageDescription = (domain: string) => ({ acs: "Census estimates and margins of error", election: "Cycle-by-cycle reported result coverage", finance: "FEC and categorized funding records", geography: "Seat-to-district geographic closure", identity: "Current officeholder links", maps: "Renderable district boundaries", member: "Biographical and service facts" } as Record<string, string>)[domain] ?? "Published release coverage";
type CoverageScope = Coverage["scope"];
function scopeLabel(scope: CoverageScope) { if (scope.kind === "release") return "Release-wide"; if (scope.kind === "jurisdiction") return "Jurisdiction-wide"; if (scope.kind === "seat_cycle") return "Seat-cycle-wide"; if (scope.kind === "acs_indicator") return `${scope.variable} · ${scope.surveyPeriod}`; if (scope.kind === "election") return `${scope.electionYear} election`; return `${words(scope.fundingKind)} funding`; }
function scopeKey(scope: CoverageScope) { return scope.kind === "acs_indicator" ? `${scope.kind}:${scope.variable}:${scope.surveyPeriod}` : scope.kind === "election" ? `${scope.kind}:${scope.electionYear}` : scope.kind === "funding" ? `${scope.kind}:${scope.fundingKind}` : scope.kind; }
