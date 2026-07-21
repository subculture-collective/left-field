import { loadProfilePage } from "@/ui/server-data";
import { Shell, RouteState, Status, Lineage, fact, fmtDate, fmtMoney, fmtNumber, words } from "@/components/presentational";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function SeatProfile({ params }: Props) {
  const result = await loadProfilePage(await params);
  if (!result.ok) return <RouteState code={result.code} />;

  const { value: page } = result;
  const p = page.headlineFacts;
  const biography = page.biography;

  return <Shell release={page.release}><main className="page">
    <p className="eyebrow">SEAT RECORD / {page.identity.geographyVintage}</p>
    <div className="identity">
      <div>
        <h1>{page.identity.geographyLabel}</h1>
        <p>{words(page.identity.chamber)} · {page.identity.stateCode}{page.identity.districtCode ? `-${page.identity.districtCode}` : ""} · {words(page.identity.incumbencyStatus)}</p>
      </div>
      <dl>
        <dt>Current holder</dt>
        <dd>{page.identity.currentHolder ?? "No current holder recorded"}{page.identity.currentHolderParty ? ` · ${words(page.identity.currentHolderParty)}` : ""}</dd>
        <dt>Occupancy</dt>
        <dd>{words(page.identity.occupancyStatus)} as of {fmtDate(page.identity.occupancyAsOf)}</dd>
      </dl>
    </div>

    <section className="fact-grid" aria-label="Headline sourced facts">
      <article>
        <p className="eyebrow">2024 PRESIDENTIAL MARGIN</p>
        <h2>{fact(p.presidentialMargin2024.value, x => `${x > 0 ? "+" : ""}${x.toFixed(1)} pp`)}</h2>
        <Lineage status={p.presidentialMargin2024.status} asOf={p.presidentialMargin2024.asOf} methodology={p.presidentialMargin2024.methodology} inputs={p.presidentialMargin2024.inputSnapshotIds} />
      </article>
      <article>
        <p className="eyebrow">{p.cashOnHand.kind === "aggregate" ? "CASH ON HAND / AGGREGATE" : "CASH ON HAND / FEC SUMMARY"}</p>
        <h2>{p.cashOnHand.kind === "value" ? fmtMoney(p.cashOnHand.value) : p.cashOnHand.kind === "aggregate" ? `Aggregate — ${fmtMoney(p.cashOnHand.value)}` : `Unavailable — ${words(p.cashOnHand.reason)}`}</h2>
        <p className="lineage">{p.cashOnHand.kind === "value" ? <>Filed {fmtDate(p.cashOnHand.filedAt)} · reporting through {fmtDate(p.cashOnHand.coverageThrough)} · {p.cashOnHand.inputSnapshotIds.length} input snapshots</> : p.cashOnHand.kind === "aggregate" ? <>Aggregate as of {fmtDate(p.cashOnHand.asOf)} · coverage through {fmtDate(p.cashOnHand.coverageThrough)} · {p.cashOnHand.inputSnapshotIds.length} input snapshots</> : <>As of {fmtDate(p.cashOnHand.asOf)} · {p.cashOnHand.inputSnapshotIds.length} input snapshots</>}</p>
        <p className="muted">{p.cashOnHand.kind === "aggregate" ? <>Aggregate methodology: {p.cashOnHand.methodologyVersion}. Not a single filing or a live balance.</> : "FEC values are filing summaries, not live balances."}</p>
      </article>
    </section>

    <section className="record-section" aria-labelledby="member-record-heading">
      <p className="eyebrow">SOURCED BIOGRAPHY / COVERAGE</p>
      <h2 id="member-record-heading">Member record</h2>
      <p className="muted">Facts are limited to this release’s source cutoff: {fmtDate(page.release.sourceCutoff)}. Bioguide coverage is an identity-match measure, not complete biography coverage.</p>
      {(page.identity.occupancyStatus !== "occupied" || !page.identity.currentHolder) && <p className="empty-copy">No current member biography is attached to this seat record.</p>}
      <dl>
        <dt>Bioguide ID</dt>
        <dd>{biography.bioguideId?.kind === "value" ? biography.bioguideId.value : biography.bioguideId?.kind === "missing" ? `Unavailable — ${words(biography.bioguideId.reason)}` : "Unavailable — no Bioguide ID fact attached"}</dd>
        <dt>Birth date</dt>
        <dd>{biography.birthDate?.kind === "value" ? fmtDate(biography.birthDate.value) : biography.birthDate?.kind === "missing" ? `Unavailable — ${words(biography.birthDate.reason)}` : "Unavailable — no birth-date fact attached"}</dd>
      </dl>
      {biography.facts.length > 0 && <div className="table-wrap">
        <table>
          <caption>Member fact observations and provenance snapshots</caption>
          <thead><tr><th>Fact</th><th>Recorded value</th><th>Effective / observed</th><th>Provenance snapshots</th></tr></thead>
          <tbody>{biography.facts.map((row) => <tr key={`${row.fact}-${row.effectiveAt}`}>
            <td><strong>{words(row.fact)}</strong></td>
            <td>{row.value.kind === "value" ? (row.fact === "birth_date" ? fmtDate(row.value.value) : row.value.value) : `Unavailable — ${words(row.value.reason)}`}</td>
            <td>{fmtDate(row.effectiveAt)}</td>
            <td>{row.provenance.map((reference) => <span key={`${String(reference.snapshotId)}-${reference.role}`}>{String(reference.snapshotId)} · {words(reference.role)}</span>)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {biography.memberCoverage ? <p className="lineage"><Status>{biography.memberCoverage.status}</Status><span>Release-wide member identity-match coverage</span><span>{biography.memberCoverage.observedCount} observed / {biography.memberCoverage.expectedCount} expected</span><span>{biography.memberCoverage.inputSnapshotIds.length} input {biography.memberCoverage.inputSnapshotIds.length === 1 ? "snapshot" : "snapshots"}</span></p> : <p className="empty-copy">Release-wide member identity-match coverage is unavailable for this profile.</p>}
      <p className="muted">{biography.committeeAssignmentsNote}</p>
    </section>

    <section className="record-section"><h2>Election coverage decisions</h2>{page.electionDecisions.length === 0 ? <p className="empty-copy">Unassessed — no election coverage decision is published for this profile.</p> : page.electionDecisions.map(decision => <p className="lineage" key={decision.electionYear}><Status>{decision.status}</Status><span>{decision.electionYear} election coverage</span><span>{decision.status === "unassessed" ? "Unassessed" : decision.status === "unavailable" ? "Unavailable — not defensibly modeled" : "Approved"}</span>{decision.coverage && <span>{decision.coverage.observedCount} observed / {decision.coverage.expectedCount} expected</span>}<span>{decision.inputSnapshotIds.length} input {decision.inputSnapshotIds.length === 1 ? "snapshot" : "snapshots"}</span></p>)}</section>
    <section className="record-section"><h2>Election records</h2>{page.elections.length === 0 ? <p className="empty-copy">Unavailable — no election records in this profile.</p> : page.elections.map(e => <article className="contest" key={String(e.id)}><h3>{words(e.kind)} · {words(e.round)} · {fmtDate(e.electionDate)}</h3><Lineage status={e.lineage.status} asOf={e.lineage.asOf} methodology={e.lineage.methodology} inputs={e.lineage.inputs} /><p><Status>{e.certificationStatus}</Status> {e.reportingCompletenessPercent}% reporting · {words(e.reportingUnit)} · allocation: {words(e.allocationMethod)} ({fact(e.allocationCoveragePercent)}) · denominator: {fact(e.denominatorVotes)}</p><div className="results">{page.electionResults.filter(r => r.contestId === e.id).map(r => <div key={String(r.resultOptionId)}><strong>{r.label}</strong><span>{r.party ? words(r.party) : "Party unavailable"} · {r.optionKind}</span><b>{fact(r.votes)}</b><Lineage status={r.lineage.status} asOf={r.lineage.asOf} methodology={r.lineage.methodology} inputs={r.lineage.inputs} /></div>)}</div></article>)}</section>
    <section className="record-section"><h2>District context / ACS</h2><p className="muted">Descriptive district context only; it is not available as a filter or targeting input.</p>{page.demographics.length === 0 ? <p className="empty-copy">{page.acsAvailability.kind === "incompatible_geography" ? "Unavailable — this geography is incompatible with ACS district coverage." : "Unavailable — no ACS observations in this profile."}</p> : <div className="table-wrap"><table><thead><tr><th>Measure</th><th>Estimate</th><th>Margin of error</th><th>Period / universe</th></tr></thead><tbody>{page.demographics.map(d => <tr key={d.variable}><td><strong>{d.label}</strong><small>{d.variable} · {d.unit}</small></td><td>{fact(d.estimate, d.unit === "usd" ? fmtMoney : fmtNumber)}</td><td>{fact(d.marginOfError, d.unit === "usd" ? fmtMoney : fmtNumber)}</td><td>{d.surveyPeriod}<small>{d.universe}</small><Lineage status={d.lineage.status} asOf={d.lineage.asOf} methodology={d.lineage.methodology} inputs={d.lineage.inputs} /></td></tr>)}</tbody></table></div>}</section>
    <section className="record-section"><h2>Gross committee finance</h2><p className="muted">Gross totals across included committees; no transfer netting.</p>{page.financeAggregates.map(a => <article key={String(a.id)}><h3>Gross cash {fact(a.cashOnHand, fmtMoney)}</h3><p>Gross receipts {fact(a.receipts, fmtMoney)} · gross disbursements {fact(a.disbursements, fmtMoney)}</p><p className="lineage">Coverage through {fmtDate(a.coverageThrough)} · as of {fmtDate(a.asOf)} · {a.methodologyVersion} · {a.includedCommitteeCount} included / {a.missingCommitteeCount} missing committees</p></article>)}<h2>FEC filing history</h2>{page.financeCoverage ? <p className="lineage"><Status>{page.financeCoverage.status}</Status><span>Finance summary coverage</span><span>{page.financeCoverage.observedCount} observed / {page.financeCoverage.expectedCount} expected</span></p> : <p className="empty-copy">Finance summary coverage is unavailable for this profile.</p>}{page.finance.length === 0 ? <p className="empty-copy">No filing summaries are attached to this profile.</p> : <div className="table-wrap"><table><thead><tr><th>Report</th><th>Period</th><th>Cash / receipts / disbursements</th><th>Filing context</th></tr></thead><tbody>{page.finance.map(f => <tr key={String(f.id)}><td>{f.reportType}<small>Committee {f.committeeId}</small></td><td>{fmtDate(f.reportingPeriodStart)} — {fmtDate(f.reportingPeriodEnd)}</td><td>{fact(f.cashOnHand, fmtMoney)}<small>Receipts: {fact(f.totalReceipts, fmtMoney)} · Disbursements: {fact(f.totalDisbursements, fmtMoney)}</small></td><td>{words(f.amendmentStatus)} · amendment {f.amendmentNumber}<small>Filed {fmtDate(f.filedAt)}</small><Lineage status={f.lineage.status} asOf={f.lineage.asOf} methodology={f.lineage.methodology} inputs={f.lineage.inputs} /></td></tr>)}</tbody></table></div>}</section>
    <section className="record-section provenance"><h2>Source closure</h2><p>Sources and snapshots used by this profile are listed here and in the <a href="/sources">source ledger</a>.</p><ul>{page.sourceClosure.sources.map(s => <li key={String(s.id)}><a href={s.homepageUrl}>{s.name}</a> · {s.authority}</li>)}</ul>{page.sourceClosure.snapshots.map(s => <p key={String(s.id)}><a href={s.sourceUrl}>{String(s.id)}</a> · retrieved {fmtDate(s.retrievedAt)} · {s.usageStatus}</p>)}</section>
  </main></Shell>;
}
