import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/presentational";
import { formatPartisanMargin, housePriorityBriefs } from "@/lib/house-priority-index";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "House Priority Index",
  description:
    "Ranked strategic profiles for Democratic-held and Republican-held U.S. House seats.",
};
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const value = (input: string | string[] | undefined): string =>
  typeof input === "string" ? input : "";

export default async function Priorities({ searchParams }: Props) {
  const briefs = housePriorityBriefs(), params = await searchParams;
  const query = value(params.q).trim().toLocaleLowerCase("en-US"),
    state = value(params.state),
    route = value(params.route),
    showAll = value(params.show) === "all";
  const states = [...new Set(briefs.map((row) => row.stateCode))].sort();
  const filtered = briefs.filter(
    (row) =>
      (!query ||
        `${row.districtLabel} ${row.incumbentName} ${row.officialHouseName}`
          .toLocaleLowerCase("en-US")
          .includes(query)) &&
      (!state || row.stateCode === state) &&
      (!route || row.qualifyingRoute === route),
  );
  const visible =
    showAll || query || state || route
      ? filtered
      : filtered.slice(0, 50);
  const rank50Score = briefs[49]!.provisionalTargetScore;
  const seatsAtOrAbove60 = briefs.filter((row) => row.provisionalTargetScore >= 60).length;
  const republicanSeats = briefs.filter((row) => row.incumbentParty === "Republican").length;
  return (
    <Shell>
      <main className="page priorities-page">
        <header className="priority-hero">
          <div>
            <p className="eyebrow">2026 HOUSE PRIORITY INDEX · MODEL V0.4</p>
            <h1>Where the field bends.</h1>
            <p className="lede">
              A ranked field guide to 430 occupied House seats. Democratic-held
              seats combine primary opportunity, AIPAC evidence, and incumbent
              alignment; Republican-held seats enter through a deliberately
              capped general-election fringe screen.
            </p>
          </div>
          <div className="index-mark">
            <strong>{briefs.length}</strong>
            <span>seats scored</span>
            <b>50</b>
            <span>in the opening field</span>
          </div>
        </header>

        <section className="priority-stats" aria-label="Priority index summary">
          <div>
            <span>Top score</span>
            <strong>{briefs[0]!.provisionalTargetScore.toFixed(1)}</strong>
          </div>
          <div>
            <span>Rank 50</span>
            <strong>{rank50Score.toFixed(1)}</strong>
          </div>
          <div>
            <span>At least 60</span>
            <strong>{seatsAtOrAbove60}</strong>
          </div>
          <div>
            <span>GOP fringe screened</span>
            <strong>{republicanSeats}</strong>
          </div>
        </section>

        <form className="priority-filters" method="get">
          <label>
            Search
            <input
              name="q"
              defaultValue={value(params.q)}
              placeholder="District or incumbent"
            />
          </label>
          <label>
            State
            <select name="state" defaultValue={state}>
              <option value="">All states</option>
              {states.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
          <label>
            Route
            <select name="route" defaultValue={route}>
              <option value="">All routes</option>
              <option value="aipac_supported_blue">AIPAC-supported blue</option>
              <option value="deep_blue">Deep blue</option>
              <option value="republican_fringe_general">Republican-held fringe</option>
            </select>
          </label>
          <label>
            Field
            <select name="show" defaultValue={showAll ? "all" : "top50"}>
              <option value="top50">Opening 50</option>
              <option value="all">All {briefs.length}</option>
            </select>
          </label>
          <button>Apply</button>
        </form>

        <div className="priority-list">
          <div className="priority-list-head">
            <span>Rank / score</span>
            <span>Seat / incumbent</span>
            <span>Why it ranks</span>
            <span>Route</span>
          </div>
          {visible.map((row) => (
            <details className="priority-entry" key={row.seatCycleId}>
              <summary className="priority-row">
              <div className="rank-lockup">
                <span>#{row.rank}</span>
                <strong>{row.provisionalTargetScore.toFixed(1)}</strong>
              </div>
              <div>
                <span className="priority-seat">{row.districtLabel}</span>
                <h2>{row.officialHouseName}</h2>
                <p>
                  {row.incumbentParty} · {formatPartisanMargin(row.presidentialDemocraticMargin2024)} ·{" "}
                  {row.cumulativeHouseServiceYears.toFixed(1)} years in House
                </p>
              </div>
              <div className="driver-snapshot">
                {row.scoreDrivers.map((driver) => (
                  <div key={driver.key}>
                    <span>{driver.label}</span>
                    <i>
                      <b style={{ width: `${driver.score ?? 0}%` }} />
                    </i>
                    <strong>
                      {driver.score === null ? "—" : driver.score.toFixed(1)}
                    </strong>
                  </div>
                ))}
              </div>
              <div>
                <span className={`route-tag route-${row.qualifyingRoute}`}>
                  {row.qualifyingRoute === "deep_blue"
                    ? "Deep blue"
                    : row.qualifyingRoute === "aipac_supported_blue"
                      ? "AIPAC-supported blue"
                      : "Republican-held fringe"}
                </span>
              </div>
              </summary>
              <Link className="brief-link priority-direct-link" href={`/priorities/${row.seatCycleId}`}>Open brief →</Link>
              <div className="priority-expansion">
                <div><p className="eyebrow">WHY IT RANKS</p><p>{row.scoreSummary}</p></div>
                <div><p className="eyebrow">DISTRICT READ</p><p>{row.districtSummary}</p></div>
                <Link className="button" href={`/priorities/${row.seatCycleId}`}>Read the full brief →</Link>
              </div>
            </details>
          ))}
        </div>
        {visible.length === 0 && (
          <section className="empty">
            <h2>No seats match these filters.</h2>
            <Link href="/">Reset the index</Link>
          </section>
        )}
        {!showAll && !query && !state && !route && (
          <div className="show-all">
            <Link className="button" href="/?show=all">
              Open all {briefs.length} seats
            </Link>
          </div>
        )}
      </main>
    </Shell>
  );
}
