import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, fmtMoney } from "@/components/presentational";
import { formatPartisanMargin } from "@/lib/house-priority-index";
import { getDefaultPriorityRepository } from "@/lib/priority-index-store";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = getDefaultPriorityRepository().getBrief((await params).id);
  return row
    ? {
        title: `${row.districtLabel} · ${row.officialHouseName}`,
        description: row.scoreSummary,
      }
    : { title: "Priority brief" };
}

export default async function PriorityBrief({ params }: Props) {
  const repo = getDefaultPriorityRepository();
  const model = repo.getModelRelease();
  const briefs = repo.getBriefs();
  const row = repo.getBrief((await params).id);
  if (!row) notFound();
  return (
    <Shell>
      <main className="page priority-detail">
        <Link className="back-link" href="/">
          ← Priority Index
        </Link>
        <header className="brief-hero">
          <div>
            <p className="eyebrow">
              RANK {row.rank} / {briefs.length} · {row.districtLabel}{row.openSeatSignal ? " · OPEN SEAT" : ""} · MODEL {model.version}
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
              <dt>{row.chamber === "governor" ? "Open States id" : "BioGuide"}</dt>
              <dd>{row.bioguideId}</dd>
              <dt>{row.chamber === "governor" ? "Term start" : `First ${row.chamber === "senate" ? "Senate" : "House"} service`}</dt>
              <dd>{row.firstHouseServiceDate}</dd>
              <dt>{row.chamber === "house" ? "District changes" : "Next election"}</dt>
              <dd>{row.chamber === "house" ? row.districtChangeCount : row.nextElectionYear}</dd>
              <dt>Alignment gap</dt>
              <dd>
                {row.scoreDrivers.find((driver) => driver.key === "incumbent_alignment_gap")?.score?.toFixed(1) ?? "Not used"}
              </dd>
            </dl>
          </article>
          <article>
            <p className="eyebrow">{row.chamber === "house" ? "THE DISTRICT" : "THE STATE"}</p>
            <h2>{row.districtLabel}</h2>
            <p>{row.districtSummary}</p>
            <dl className="brief-facts">
              <dt>2024 presidential margin</dt>
              <dd>{formatPartisanMargin(row.presidentialDemocraticMargin2024)}</dd>
              <dt>Cash on hand</dt>
              <dd>
                {row.incumbentCashOnHand === null
                  ? "Not reported"
                  : fmtMoney(row.incumbentCashOnHand)}
              </dd>
              <dt>Receipts / disbursements</dt>
              <dd>{row.incumbentReceipts === null ? "Not reported" : fmtMoney(row.incumbentReceipts)} / {row.incumbentDisbursements === null ? "Not reported" : fmtMoney(row.incumbentDisbursements)}</dd>
              <dt>Finance through</dt>
              <dd>{row.financeCoverageThrough ?? "Not reported"}</dd>
              <dt>Route</dt>
              <dd>
                {row.qualifyingRoute === "deep_blue"
                  ? "Deep blue"
                  : row.qualifyingRoute === "aipac_supported_blue"
                    ? "AIPAC-supported blue"
                    : row.qualifyingRoute === "democratic_incumbent_primary"
                      ? "Democratic incumbent route"
                      : "Republican-held flip screen"}
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
          <p className="eyebrow">{row.chamber === "senate" ? "SENATE TERM" : row.chamber === "governor" ? "GUBERNATORIAL TERM" : "HOUSE HISTORY"}</p>
          <h2>Recorded service</h2>
          <div className="service-timeline">
            {row.serviceHistory.map((term) => (
              <div key={`${term.stateCode}-${term.district}-${term.start}`}>
                <span>
                  {term.start.slice(0, 4)}–
                  {term.currentAtCutoff ? "now" : term.end.slice(0, 4)}
                </span>
                <strong>
                  {term.stateCode}-{typeof term.district === "number" ? String(term.district).padStart(2, "0") : term.district}
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
            Source cutoff {model.cutoffDate} · deterministic rank and narrative ·{" "}
            <Link href="/methodology">Methodology</Link>
          </p>
        </section>
      </main>
    </Shell>
  );
}
