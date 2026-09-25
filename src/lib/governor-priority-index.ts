import { readGovernorScoreV01Projection, type GovernorScoreV01Row } from "@/rapid-acquisition/governor-score-v01";

import { formatPartisanMargin, type PriorityDriver, type PublicPriorityBrief } from "./house-priority-index";

/**
 * Governor briefs for the public index, read from the lock-verified governor
 * projection. Shares the brief shape with the House and Senate so all three
 * rank in one list; `chamber` is "governor".
 */
function drivers(row: GovernorScoreV01Row): PriorityDriver[] {
  const margin = formatPartisanMargin(row.presidentialDemocraticMargin2024);
  if (row.route === "democratic_incumbent_primary") {
    return [
      { key: "blue_baseline", label: "Blue baseline", score: row.blueBaseline, coverage: 1, inferred: false, explanation: `The statewide 2024 presidential result was ${margin}. The baseline is 0 at a 5-point Democratic margin and 100 at 30 points.` },
      { key: "primary_feasibility", label: "Primary feasibility", score: null, coverage: 0, inferred: false, explanation: "No governor primary evidence is retained; nothing is imputed." },
      { key: "incumbent_alignment_gap", label: "Incumbent alignment gap", score: null, coverage: 0, inferred: false, explanation: "The retained alignment trackers cover Congress only, so the weight is omitted." },
      { key: "cash_vulnerability", label: "Cash vulnerability", score: null, coverage: 0, inferred: false, explanation: "State campaign-finance filings are not retained, so the weight is omitted." },
    ];
  }
  return [
    { key: "general_election_competitiveness", label: "General-election competitiveness", score: row.competitiveness, coverage: 1, inferred: false, explanation: `The statewide 2024 presidential result was ${margin}. A tied state begins at 100 and each Republican margin point subtracts four points.` },
    { key: "cash_vulnerability", label: "Cash vulnerability", score: null, coverage: 0, inferred: false, explanation: "State campaign-finance filings are not retained, so the weight is omitted." },
    { key: "state_primary_contestation", label: "State Democratic primary contestation", score: row.stateContestation, coverage: row.stateContestation === null ? 0 : 1, inferred: false, explanation: row.stateContestation === null ? "No retained state-legislative Democratic primary catalog records uncontested contests for this state, so the component is omitted." : `The retained ${row.stateContestationCycleYear} state-legislative Democratic primaries in this state score ${row.stateContestation.toFixed(1)} on a scale where a 40% contested share is 100.` },
  ];
}

export function governorPriorityBrief(row: GovernorScoreV01Row): PublicPriorityBrief {
  const margin = formatPartisanMargin(row.presidentialDemocraticMargin2024);
  const democratic = row.route === "democratic_incumbent_primary";
  const pct = Math.round(row.availableWeight * 100);
  const termYears = row.termStart ? Math.round(((Date.parse(row.termEnd) - Date.parse(row.termStart)) / 31_557_600_000) * 10) / 10 : 0;
  return {
    rank: 0,
    seatCycleId: row.seatId,
    chamber: "governor",
    nextElectionYear: row.nextElectionYear,
    openSeatSignal: null,
    districtLabel: row.seatLabel,
    stateCode: row.stateCode,
    districtCode: "Gov",
    incumbentName: row.governorName,
    officialHouseName: row.governorName,
    bioguideId: row.openStatesId,
    birthYear: 0,
    incumbentParty: row.caucus,
    provisionalTargetScore: row.score,
    baselineTargetScore: row.blueBaseline ?? row.competitiveness ?? row.score,
    formula: row.formula,
    qualifyingRoute: row.route,
    scoreDrivers: drivers(row),
    presidentialDemocraticMargin2024: row.presidentialDemocraticMargin2024,
    incumbentCashOnHand: null,
    incumbentReceipts: null,
    incumbentDisbursements: null,
    financeCoverageThrough: null,
    firstHouseServiceDate: row.termStart ?? row.termEnd,
    cumulativeHouseServiceYears: termYears,
    districtChangeCount: 0,
    serviceHistory: [{ stateCode: row.stateCode, district: "Governor", start: row.termStart ?? row.termEnd, end: row.termEnd, currentAtCutoff: true }],
    scoreSummary: democratic
      ? `${row.seatLabel} scores ${row.score.toFixed(1)} on the Democratic incumbent route with ${pct}% of the component weight available: the ${margin} statewide baseline alone. No governor finance, alignment, or primary evidence is retained.`
      : `${row.seatLabel} enters through the Republican-held flip route at ${row.score.toFixed(1)} with ${pct}% of the component weight available: statewide competitiveness${row.stateContestation === null ? "" : " and state-level Democratic primary contestation"}.`,
    personSummary: `${row.governorName} is the ${row.incumbentParty} governor of ${row.stateCode}. The Open States roster records a term ending ${row.termEnd}; the office is next contested in ${row.nextElectionYear}.`,
    districtSummary: `${row.stateCode} recorded a ${margin} presidential margin statewide in 2024. State campaign-finance filings are not retained.`,
    limitations: "Statewide baseline and state contestation only. This is a comparative research index, not a forecast or endorsement; term limits and retirements are not observed.",
  };
}

let cache: PublicPriorityBrief[] | undefined;
export function governorPriorityBriefs(): readonly PublicPriorityBrief[] {
  if (!cache) cache = readGovernorScoreV01Projection().rows.map(governorPriorityBrief);
  return cache;
}
