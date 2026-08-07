import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/presentational";
import { priorityBriefs } from "@/lib/priority-briefs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "House Priority Index",
  description:
    "Ranked strategic profiles for 212 Democratic-held U.S. House seats.",
};
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const value = (input: string | string[] | undefined): string =>
  typeof input === "string" ? input : "";

export default async function Priorities({ searchParams }: Props) {
  const data = priorityBriefs(),
    params = await searchParams;
  const query = value(params.q).trim().toLocaleLowerCase("en-US"),
    state = value(params.state),
    route = value(params.route),
    showAll = value(params.show) === "all";
  const states = [...new Set(data.briefs.map((row) => row.stateCode))].sort();
  const filtered = data.briefs.filter(
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
      : filtered.slice(0, data.selection.defaultPublicViewCount);
  return (
    <Shell>
      <main className="page priorities-page">
        <header className="priority-hero">
          <div>
            <p className="eyebrow">2026 HOUSE PRIORITY INDEX</p>
            <h1>Where the field bends.</h1>
            <p className="lede">
              A ranked field guide to every Democratic-held House seat,
              combining structural opportunity, primary feasibility, AIPAC
              support, and incumbent alignment.
            </p>
          </div>
          <div className="index-mark">
            <strong>212</strong>
            <span>seats scored</span>
            <b>50</b>
            <span>in the opening field</span>
          </div>
        </header>

        <section className="priority-stats" aria-label="Priority index summary">
          <div>
            <span>Top score</span>
            <strong>{data.briefs[0]!.provisionalTargetScore.toFixed(1)}</strong>
          </div>
          <div>
            <span>Rank 50</span>
            <strong>{data.selection.rank50Score.toFixed(1)}</strong>
          </div>
          <div>
            <span>At least 60</span>
            <strong>{data.selection.seatsAtOrAbove60}</strong>
          </div>
          <div>
            <span>AIPAC route</span>
            <strong>{data.summary.aipacSupportedBlueRoute}</strong>
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
            </select>
          </label>
          <label>
            Field
            <select name="show" defaultValue={showAll ? "all" : "top50"}>
              <option value="top50">Opening 50</option>
              <option value="all">All 212</option>
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
            <article className="priority-row" key={row.seatCycleId}>
              <div className="rank-lockup">
                <span>#{row.rank}</span>
                <strong>{row.provisionalTargetScore.toFixed(1)}</strong>
              </div>
              <div>
                <Link
                  className="priority-seat"
                  href={`/priorities/${row.seatCycleId}`}
                >
                  {row.districtLabel}
                </Link>
                <h2>{row.officialHouseName}</h2>
                <p>
                  D+{row.presidentialDemocraticMargin2024.toFixed(1)} ·{" "}
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
                    : "AIPAC-supported blue"}
                </span>
                <Link
                  className="brief-link"
                  href={`/priorities/${row.seatCycleId}`}
                >
                  Open brief →
                </Link>
              </div>
            </article>
          ))}
        </div>
        {visible.length === 0 && (
          <section className="empty">
            <h2>No seats match these filters.</h2>
            <Link href="/priorities">Reset the index</Link>
          </section>
        )}
        {!showAll && !query && !state && !route && (
          <div className="show-all">
            <Link className="button" href="/priorities?show=all">
              Open all 212 seats
            </Link>
          </div>
        )}
      </main>
    </Shell>
  );
}
