import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, fmtMoney } from "@/components/presentational";
import { priorityBrief } from "@/lib/priority-briefs";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = priorityBrief((await params).id);
  return row
    ? {
        title: `${row.districtLabel} · ${row.officialHouseName}`,
        description: row.scoreSummary,
      }
    : { title: "Priority brief" };
}

export default async function PriorityBrief({ params }: Props) {
  const row = priorityBrief((await params).id);
  if (!row) notFound();
  return (
    <Shell>
      <main className="page priority-detail">
        <Link className="back-link" href="/priorities">
          ← House Priority Index
        </Link>
        <header className="brief-hero">
          <div>
            <p className="eyebrow">
              RANK {row.rank} / 212 · {row.districtLabel}
            </p>
            <h1>{row.officialHouseName}</h1>
            <p className="lede">{row.scoreSummary}</p>
          </div>
          <div className="score-seal">
            <span>Priority score</span>
            <strong>{row.provisionalTargetScore.toFixed(1)}</strong>
            <b>#{row.rank}</b>
          </div>
        </header>

        <section className="brief-columns">
          <article>
            <p className="eyebrow">THE MEMBER</p>
            <h2>Record</h2>
            <p>{row.personSummary}</p>
            <dl className="brief-facts">
              <dt>BioGuide</dt>
              <dd>{row.bioguideId}</dd>
              <dt>First House service</dt>
              <dd>{row.firstHouseServiceDate}</dd>
              <dt>District changes</dt>
              <dd>{row.districtChangeCount}</dd>
              <dt>Alignment gap</dt>
              <dd>
                {row.scoreDrivers
                  .find((driver) => driver.key === "incumbent_alignment_gap")!
                  .score!.toFixed(1)}
              </dd>
            </dl>
          </article>
          <article>
            <p className="eyebrow">THE DISTRICT</p>
            <h2>{row.districtLabel}</h2>
            <p>{row.districtSummary}</p>
            <dl className="brief-facts">
              <dt>2024 presidential margin</dt>
              <dd>D+{row.presidentialDemocraticMargin2024.toFixed(1)}</dd>
              <dt>Cash on hand</dt>
              <dd>
                {row.incumbentCashOnHand === null
                  ? "Not reported"
                  : fmtMoney(row.incumbentCashOnHand)}
              </dd>
              <dt>Route</dt>
              <dd>
                {row.qualifyingRoute === "deep_blue"
                  ? "Deep blue"
                  : "AIPAC-supported blue"}
              </dd>
              <dt>Baseline score</dt>
              <dd>{row.baselineTargetScore.toFixed(1)}</dd>
            </dl>
          </article>
        </section>

        <section className="score-anatomy">
          <div className="section-intro">
            <p className="eyebrow">SCORE ANATOMY</p>
            <h2>What makes the score</h2>
          </div>
          {row.scoreDrivers.map((driver) => (
            <article key={driver.key}>
              <div>
                <h3>{driver.label}</h3>
                <strong>
                  {driver.score === null ? "—" : driver.score.toFixed(1)}
                </strong>
              </div>
              <div className="driver-track">
                <i style={{ width: `${driver.score ?? 0}%` }} />
              </div>
              <p>{driver.explanation}</p>
            </article>
          ))}
        </section>

        <section className="record-section">
          <p className="eyebrow">HOUSE HISTORY</p>
          <h2>Recorded service</h2>
          <div className="service-timeline">
            {row.serviceHistory.map((term) => (
              <div key={`${term.stateCode}-${term.district}-${term.start}`}>
                <span>
                  {term.start.slice(0, 4)}–
                  {term.currentAtCutoff ? "now" : term.end.slice(0, 4)}
                </span>
                <strong>
                  {term.stateCode}-{String(term.district).padStart(2, "0")}
                </strong>
                <small>
                  {term.currentAtCutoff
                    ? "Current at source cutoff"
                    : "Completed term"}
                </small>
              </div>
            ))}
          </div>
        </section>

        <section className="brief-method">
          <p>
            <strong>Formula</strong> {row.formula}
          </p>
          <p>
            Source cutoff August 4, 2026 · deterministic rank and narrative ·{" "}
            <Link href="/methodology">Methodology</Link>
          </p>
        </section>
      </main>
    </Shell>
  );
}
