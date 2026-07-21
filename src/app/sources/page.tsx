import { loadSourcesPage } from "@/ui/server-data";
import type { SourcesPageViewModel } from "@/ui/view-models";
import { Shell, RouteState, Status, fmtDate, words } from "@/components/presentational";

export const dynamic = "force-dynamic";

export default async function Sources() {
  const result = await loadSourcesPage();
  if (!result.ok) return <RouteState code={result.code} />;
  const { value: page } = result;
  return <Shell release={page.release}><main className="page">
    <p className="eyebrow">SOURCE LEDGER</p><h1>Sources & snapshots</h1>
    <section className="notice"><h2>Scope of this ledger</h2><p>{page.snapshotScope}</p></section>
    <section className="record-section" aria-labelledby="coverage-ledger-heading">
      <p className="eyebrow">RELEASE COVERAGE</p><h2 id="coverage-ledger-heading">Coverage ledger</h2>
      <p className="muted">Each line retains one domain, scope discriminator, status, and stated missingness. It is a release accounting ledger, not a comparative measure.</p>
      {page.coverage.length === 0 ? <p className="empty-copy">No grouped coverage records are published for this release.</p> : <div className="table-wrap" role="region" tabIndex={0} aria-label="Release coverage ledger. Scroll horizontally to view all columns."><table><caption>Grouped release coverage; unlike the snapshot inventory, this is a finite aggregate read.</caption><thead><tr><th>Domain / scope</th><th>Status</th><th>Records</th><th>Observed / expected</th><th>Quarantined / incompatible</th><th>Missing reasons</th><th>Input snapshots</th></tr></thead><tbody>{page.coverage.map((row) => <tr key={`${row.domain}-${scopeKey(row.scope)}-${row.status}`}><td><strong>{words(row.domain)}</strong><small>{scopeLabel(row.scope)}</small></td><td><Status>{row.status}</Status></td><td>{row.recordCount}</td><td>{row.observedCount} / {row.expectedCount}</td><td>{row.quarantinedCount} / {row.incompatibleCount}</td><td>{row.missingByReason.length === 0 ? "—" : row.missingByReason.map((item) => `${words(item.reason)}: ${item.count}`).join("; ")}</td><td>{row.inputSnapshotCount}</td></tr>)}</tbody></table></div>}
    </section>
    {page.sources.map(({ source, snapshots }) => <section className="record-section source" key={String(source.id)}><h2><a href={source.homepageUrl}>{source.name}</a></h2><p>Authority: <Status>{source.authority}</Status> · source ID {source.id}</p>{snapshots.length === 0 ? <p className="empty-copy">No snapshots fall within this page closure.</p> : <div className="table-wrap" role="region" tabIndex={0} aria-label={`${source.name} snapshots. Scroll horizontally to view all columns.`}><table><thead><tr><th>Snapshot</th><th>Dates</th><th>License / usage</th><th>Checksum / parser</th></tr></thead><tbody>{snapshots.map((snapshot) => <tr key={String(snapshot.id)}><td><a href={snapshot.sourceUrl}>{snapshot.id}</a></td><td>Published: {fmtDate(snapshot.publishedAt)}<small>Retrieved: {fmtDate(snapshot.retrievedAt)}</small></td><td>{snapshot.license}<small><Status>{snapshot.usageStatus}</Status></small></td><td><code>{snapshot.checksumSha256.slice(0, 12)}…</code><small>{snapshot.parserVersion}</small></td></tr>)}</tbody></table></div>}</section>)}
  </main></Shell>;
}

type CoverageScope = SourcesPageViewModel["coverage"][number]["scope"];
function scopeLabel(scope: CoverageScope) { if (scope.kind === "release") return "Release-wide"; if (scope.kind === "jurisdiction") return "Jurisdiction-wide"; if (scope.kind === "seat_cycle") return "Seat-cycle-wide"; if (scope.kind === "acs_indicator") return `ACS: ${scope.variable} · ${scope.surveyPeriod}`; if (scope.kind === "election") return `Election: ${scope.electionYear}`; return `Funding: ${scope.fundingKind}`; }
function scopeKey(scope: CoverageScope) { return scope.kind === "acs_indicator" ? `${scope.kind}:${scope.variable}:${scope.surveyPeriod}` : scope.kind === "election" ? `${scope.kind}:${scope.electionYear}` : scope.kind === "funding" ? `${scope.kind}:${scope.fundingKind}` : scope.kind; }
