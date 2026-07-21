import Link from "next/link";
import { loadBrowsePage } from "@/ui/server-data";
import { Shell, RouteState, Status, fact, fmtDate, fmtMoney, words } from "@/components/presentational";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function nextPageHref(query: Record<string, string | number | undefined>, cursor: string) {
 const params = new URLSearchParams();
 for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
 params.set("cursor", cursor);
 return `/?${params.toString()}`;
}

export default async function Home({ searchParams }: Props) {
 const result = await loadBrowsePage(await searchParams);
 if (!result.ok) return <RouteState code={result.code} />;

 const { value: page } = result;
 const nextHref = page.nextCursor ? nextPageHref(page.appliedQuery, page.nextCursor) : null;

 return <Shell release={page.release}><main className="page">
  <div className="section-head"><div><p className="eyebrow">FEDERAL SEAT RESEARCH / RELEASE LEDGER</p><h1>Browse the active record</h1><p className="lede">Factual seat records for this release, published with source context and stated coverage. Field availability varies by record; this release does not claim complete enrichment.</p></div><aside className="disclosure">{page.disclosure.coverage}<br />{page.disclosure.rankings}<br />{page.disclosure.demographicFilters}</aside></div>
  <form className="filters" method="get"><label>Find a district or officeholder<input name="identitySearch" defaultValue={page.appliedQuery.identitySearch} /></label><label>Chamber<select name="chamber" defaultValue={page.appliedQuery.chamber ?? ""}><option value="">All</option><option value="house">House</option><option value="senate">Senate</option></select></label><label>State<select name="stateCode" defaultValue={page.appliedQuery.stateCode ?? ""}><option value="">All</option>{page.available.states.map(x => <option key={x}>{x}</option>)}</select></label><label>Party<select name="party" defaultValue={page.appliedQuery.party ?? ""}><option value="">All</option>{page.available.parties.map(x => <option key={x}>{words(x)}</option>)}</select></label><label>Seat status<select name="incumbencyStatus" defaultValue={page.appliedQuery.incumbencyStatus ?? ""}><option value="">All</option>{page.available.incumbencyStatuses.map(x => <option key={x}>{words(x)}</option>)}</select></label><label>Election year<select name="electionYear" defaultValue={page.appliedQuery.electionYear?.toString() ?? ""}><option value="">All</option>{page.available.electionYears.map(x => <option key={x}>{x}</option>)}</select></label><label>Order records by<select name="sort" defaultValue={page.appliedQuery.sort}><option value="state">State</option><option value="district">District</option><option value="incumbent_name">Officeholder name</option><option value="election_year">Election year</option><option value="cash_on_hand">Cash on hand</option><option value="presidential_margin_2024">2024 presidential margin</option></select></label><label>Direction<select name="direction" defaultValue={page.appliedQuery.direction}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label><button>Apply factual filters</button></form><p className="filter-note">Ordering is selected by you; it is not a ranking.</p>
  {page.rows.length === 0 ? <section className="empty"><h2>No records match these factual filters.</h2><Link prefetch={false} href="/">Clear filters</Link></section> : <><div className="table-wrap" role="region" tabIndex={0} aria-label="Browse seat records. Scroll horizontally to view all columns."><table><caption>Showing {page.rows.length} of {page.total} released seat records</caption><thead><tr><th>District / officeholder</th><th>Office</th><th>Election context</th><th>2024 presidential fact</th><th>FEC filing summary</th><th>Coverage</th></tr></thead><tbody>{page.rows.map(row => <tr key={String(row.id)}><td><Link prefetch={false} className="record-link" href={`/seats/${row.id}`}>{row.label}</Link><strong>{row.incumbentName ?? "Vacant / no current holder recorded"}</strong><span>{row.incumbentParty ? words(row.incumbentParty) : "Party unavailable"} · {words(row.incumbencyStatus)}</span></td><td><strong>{officeLabel(row.officeKind)}</strong><small>{words(row.chamber)} office</small></td><td>{row.electionYear}<span>{words(row.chamber)} record</span></td><td><strong>{fact(row.presidentialMargin2024.value, value => `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`)}</strong><Status>{row.presidentialMargin2024.status}</Status><small>As of {fmtDate(row.presidentialMargin2024.asOf)} · {row.presidentialMargin2024.methodology}</small></td><td><strong>{row.cashOnHand.kind === "missing" ? `Unavailable — ${words(row.cashOnHand.reason)}` : row.cashOnHand.kind === "aggregate" ? `Aggregate — ${fmtMoney(row.cashOnHand.value)}` : fmtMoney(row.cashOnHand.value)}</strong><small>{row.cashOnHand.kind === "value" ? `Filed ${fmtDate(row.cashOnHand.filedAt)} · through ${fmtDate(row.cashOnHand.coverageThrough)}` : row.cashOnHand.kind === "aggregate" ? `Coverage through ${fmtDate(row.cashOnHand.coverageThrough)} · as of ${fmtDate(row.cashOnHand.asOf)}` : `As of ${fmtDate(row.cashOnHand.asOf)}`}</small></td><td>{row.coverageLabel}</td></tr>)}</tbody></table></div>{nextHref && <nav className="pagination" aria-label="Browse records"><Link prefetch={false} className="button" href={nextHref}>Next 50 records <span aria-hidden="true">→</span></Link></nav>}</>}
 </main></Shell>;
}

function officeLabel(kind: "house_voting" | "house_delegate" | "resident_commissioner" | "senate") { return ({ house_voting: "Voting member", house_delegate: "Delegate", resident_commissioner: "Resident Commissioner", senate: "Senator" })[kind]; }
