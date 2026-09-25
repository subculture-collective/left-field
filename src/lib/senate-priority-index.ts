import { readSenateScoreV01Projection, type SenateScoreV01Row } from "@/rapid-acquisition/senate-score-v01";

import { formatPartisanMargin, type PriorityDriver, type PublicPriorityBrief } from "./house-priority-index";

/**
 * Senate briefs for the public index, read from the lock-verified Senate
 * projection. The brief shape is shared with the House so the two chambers
 * rank in one list; House-named fields carry the Senate equivalents and
 * `chamber` tells the UI which labels to use.
 */
const money = (value: number): string => `$${Math.round(value).toLocaleString("en-US")}`;

function drivers(row: SenateScoreV01Row): PriorityDriver[] {
  const margin = formatPartisanMargin(row.presidentialDemocraticMargin2024);
  const cashExplanation = row.cashOnHand === null
    ? "The FEC candidate summary has no principal-campaign row for this senator, so finance is omitted and the available weights are renormalized."
    : `The FEC candidate summary reports ${money(row.cashOnHand)} cash on hand through ${row.financeCoverageThrough}. The inverse log scale is 100 at $50,000 or less and 0 at $5 million or more.`;
  if (row.route === "democratic_incumbent_primary") {
    return [
      { key: "blue_baseline", label: "Blue baseline", score: row.blueBaseline, coverage: 1, inferred: false, explanation: `The statewide 2024 presidential result was ${margin}. The baseline is 0 at a 5-point Democratic margin and 100 at 30 points; only 2024 is retained statewide, so no multi-cycle floor applies.` },
      { key: "primary_feasibility", label: "Primary feasibility", score: null, coverage: 0, inferred: false, explanation: "No retained Senate primary evidence exists, so the structural baseline is the blue baseline alone. Nothing is imputed." },
      { key: "incumbent_alignment_gap", label: "Incumbent alignment gap", score: row.alignmentGap, coverage: row.alignmentCoverage, inferred: row.alignmentCoverage < 1 && row.alignmentGap !== null, explanation: row.alignmentGap === null ? "The retained trackers have no Senate row for this member, so the alignment weight is omitted." : `The 119th Senate sheets of the retained Left and Palestine trackers score this member ${row.leftScore} and ${row.palestineScore ?? "not graded"}. The gap is the mean distance from full alignment, scaled by tracker coverage.` },
      { key: "cash_vulnerability", label: "Cash vulnerability", score: row.cashVulnerability, coverage: row.cashOnHand === null ? 0 : 1, inferred: false, explanation: cashExplanation },
    ];
  }
  return [
    { key: "general_election_competitiveness", label: "General-election competitiveness", score: row.competitiveness, coverage: 1, inferred: false, explanation: `The statewide 2024 presidential result was ${margin}. A tied state begins at 100 and each Republican margin point subtracts four points.` },
    { key: "primary_feasibility", label: "Democratic primary", score: null, coverage: 0, inferred: false, explanation: "Not applicable to this Republican-held route; no Democratic-primary value is imputed." },
    { key: "aipac_support", label: "AIPAC support", score: null, coverage: 0, inferred: false, explanation: "Not used in this route; the retained AIPAC model covers the Democratic House field." },
    { key: "incumbent_alignment_gap", label: "Incumbent alignment", score: null, coverage: 0, inferred: false, explanation: "Not used in this route because the retained alignment trackers cover the Democratic caucus." },
    { key: "cash_vulnerability", label: "Cash vulnerability", score: row.cashVulnerability, coverage: row.cashOnHand === null ? 0 : 1, inferred: false, explanation: cashExplanation },
    { key: "state_primary_contestation", label: "State Democratic primary contestation", score: row.stateContestation, coverage: row.stateContestation === null ? 0 : 1, inferred: false, explanation: row.stateContestation === null ? "No retained state-legislative Democratic primary catalog records uncontested contests for this state, so the component is omitted and the available weight is renormalized." : `The retained ${row.stateContestationCycleYear} state-legislative Democratic primaries in this state score ${row.stateContestation.toFixed(1)} on a scale where a 40% contested share is 100. This is state-level organizing context, not a seat measure.` },
  ];
}

export function senatePriorityBrief(row: SenateScoreV01Row): PublicPriorityBrief {
  const margin = formatPartisanMargin(row.presidentialDemocraticMargin2024);
  const democratic = row.route === "democratic_incumbent_primary";
  const partyLabel = row.incumbentParty === "Independent" ? "Independent (caucuses with Democrats)" : row.incumbentParty;
  const pct = Math.round(row.availableWeight * 100);
  return {
    rank: 0,
    seatCycleId: row.seatId,
    chamber: "senate",
    nextElectionYear: row.nextElectionYear,
    openSeatSignal: null,
    districtLabel: row.seatLabel,
    stateCode: row.stateCode,
    districtCode: `S${row.senateClass}`,
    incumbentName: row.officialName,
    officialHouseName: row.officialName,
    bioguideId: row.bioguideId,
    birthYear: row.birthYear ?? 0,
    incumbentParty: row.caucus,
    provisionalTargetScore: row.score,
    baselineTargetScore: row.structuralBaseline ?? row.competitiveness ?? row.score,
    formula: row.formula,
    qualifyingRoute: row.route,
    scoreDrivers: drivers(row),
    presidentialDemocraticMargin2024: row.presidentialDemocraticMargin2024,
    incumbentCashOnHand: row.cashOnHand,
    incumbentReceipts: row.receipts,
    incumbentDisbursements: row.disbursements,
    financeCoverageThrough: row.financeCoverageThrough,
    firstHouseServiceDate: row.firstSenateServiceDate,
    cumulativeHouseServiceYears: row.cumulativeSenateServiceYears,
    districtChangeCount: 0,
    serviceHistory: [{ stateCode: row.stateCode, district: `Class ${row.senateClass}`, start: row.termStart, end: row.termEnd, currentAtCutoff: true }],
    scoreSummary: democratic
      ? `${row.seatLabel} scores ${row.score.toFixed(1)} on the Democratic incumbent route with ${pct}% of the component weight available: a ${margin} statewide baseline${row.alignmentGap === null ? "" : ", tracker alignment"}${row.cashOnHand === null ? ", and no reported cash" : ", and reported cash on hand"}. Senate primary feasibility is not measured.`
      : `${row.seatLabel} enters through the Republican-held flip route at ${row.score.toFixed(1)} with ${pct}% of the component weight available: statewide competitiveness${row.cashOnHand === null ? "" : ", incumbent cash vulnerability"}${row.stateContestation === null ? "" : ", and state-level Democratic primary contestation"}.`,
    personSummary: `${row.officialName} is the ${partyLabel} senator in ${row.stateCode} Class ${row.senateClass}${row.appointed ? ", serving by appointment" : ""}. The retained roster records ${row.cumulativeSenateServiceYears.toFixed(1)} cumulative years of Senate service through the source cutoff; the seat is next contested in ${row.nextElectionYear}.`,
    districtSummary: `${row.stateCode} recorded a ${margin} presidential margin statewide in 2024.${row.cashOnHand === null ? " No FEC candidate summary row is retained for this senator." : ` The senator reported ${money(row.cashOnHand)} cash on hand through ${row.financeCoverageThrough}.`}`,
    limitations: democratic
      ? "Statewide baseline only, no Senate primary evidence, and no AIPAC component. This is a comparative research index, not a forecast or endorsement."
      : "This is a structural flip screen, not a forecast, endorsement, candidate-quality assessment, or claim that a Democratic challenger is present.",
  };
}

let cache: PublicPriorityBrief[] | undefined;
export function senatePriorityBriefs(): readonly PublicPriorityBrief[] {
  if (!cache) cache = readSenateScoreV01Projection().rows.map(senatePriorityBrief);
  return cache;
}
