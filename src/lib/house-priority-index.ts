import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { priorityBriefs } from "./priority-briefs";

export type PriorityDriver = Readonly<{
  key: string;
  label: string;
  score: number | null;
  coverage: number;
  inferred: boolean;
  explanation: string;
}>;

export type PublicPriorityBrief = Readonly<{
  rank: number;
  seatCycleId: string;
  districtLabel: string;
  stateCode: string;
  districtCode: string;
  incumbentName: string;
  officialHouseName: string;
  bioguideId: string;
  birthYear: number;
  incumbentParty: "Democratic" | "Republican";
  provisionalTargetScore: number;
  baselineTargetScore: number;
  formula: string;
  qualifyingRoute: "deep_blue" | "aipac_supported_blue" | "republican_fringe_general";
  scoreDrivers: readonly PriorityDriver[];
  presidentialDemocraticMargin2024: number;
  incumbentCashOnHand: number | null;
  incumbentReceipts: number | null;
  incumbentDisbursements: number | null;
  financeCoverageThrough: string | null;
  firstHouseServiceDate: string;
  cumulativeHouseServiceYears: number;
  districtChangeCount: number;
  serviceHistory: readonly Readonly<{ stateCode: string; district: number | string; start: string; end: string; currentAtCutoff: boolean }>[];
  scoreSummary: string;
  personSummary: string;
  districtSummary: string;
  limitations: string;
}>;

type Legislator = { id?: { bioguide?: string }; bio?: { birthday?: string }; terms?: Array<{ type?: string; state?: string; district?: number; start?: string; end?: string }> };
type FinanceFact = { kind: "value"; value: number } | { kind: "missing"; reason: string };
type FinanceRow = { seatCycleId: string; incumbentParty: "democratic" | "republican"; coverageThrough: string | null; cashOnHand: FinanceFact; receipts: FinanceFact; disbursements: FinanceFact };
type FinanceProjection = { schema: string; universe: { observed: number }; summary: { cashOnHandValues: number }; rows: FinanceRow[]; projectionSha256: string };
type V04ActiveRow = { seatCycleId: string; districtLabel: string; previousScoreVersion: "v0.3"; previousScore: number; activeScoreVersion: "v0.4"; activeScore: number; localContext: number | null; localContextAvailableWeight: number; exactGeographyJoin: "at_large_statewide" | "not_yet_eligible"; movement: number };
type V04ActiveProjection = { schema: "house-score-v04-active-projection-v1"; version: 1; activationPolicy: { status: "active"; scope: "exact_at_large_geography_only"; splitCountyAllocation: false; researchFallbackScoreInputs: false }; rows: V04ActiveRow[]; summary: { seats: 430; localContextActiveSeats: 3; unchangedSeats: 427; routeChanges: 0; movementCapBreaches: 0 }; rowSetSha256: string; packageSha256: string };
type V05ActiveRow = { seatCycleId: string; districtLabel: string; previousScoreVersion: "v0.4"; previousScore: number; activeScoreVersion: "v0.5"; activeScore: number; localContext: number | null; localContextAvailableWeight: number; downBallotDemocraticOverperformance: number | null; houseDemocraticShare: number | null; presidentialDemocraticShare: number | null; houseMinusPresidentPercentagePoints: number | null; exactGeographyJoin: "at_large_statewide" | "not_yet_eligible"; evidenceConfidence: "research_fallback_exact_at_large" | "not_available"; movementFromV04: number };
type V05ActiveProjection = { schema: "house-score-v05-active-projection-v1"; version: 1; methodology: { status: "active"; scope: "exact_at_large_geography_only"; splitCountyAllocation: false; researchFallbackScoreInputs: true; winnerInference: false }; rows: V05ActiveRow[]; summary: { seats: 430; downBallotActiveSeats: 2; unchangedSeats: 428; geographyExcludedSeats: 1; routeChanges: 0; movementCapBreaches: 0 }; rowSetSha256: string; packageSha256: string };
type V06ActiveRow = { seatCycleId: string; districtLabel: string; previousScoreVersion: "v0.5"; previousScore: number; activeScoreVersion: "v0.6"; activeScore: number; localContext: number | null; localContextAvailableWeight: number; downBallotDemocraticOverperformance: number | null; houseDemocraticShare: number | null; presidentialDemocraticShare: number | null; houseMinusPresidentPercentagePoints: number | null; exactGeographyJoin: "at_large_statewide" | "not_yet_eligible"; evidenceConfidence: "research_fallback_exact_at_large" | "research_fallback_exact_at_large_official_fips_normalization" | "not_available"; officialCountyFipsNormalizationApplied: boolean; movementFromV05: number };
type V06ActiveProjection = { schema: "house-score-v06-active-projection-v1"; version: 1; methodology: { status: "active"; scope: "exact_at_large_geography_with_official_identifier_normalization"; countyIdentifierNormalization: "only_official_census_documented_46113_to_46102_change"; splitCountyAllocation: false; researchFallbackScoreInputs: true; winnerInference: false }; rows: V06ActiveRow[]; summary: { seats: 430; downBallotActiveSeats: 3; newlyActivatedSeats: 1; unchangedSeats: 429; normalizedFipsSeats: 1; routeChanges: 0; movementCapBreaches: 0 }; rowSetSha256: string; packageSha256: string };
type V07ActiveRow = { seatCycleId: string; districtLabel: string; previousScoreVersion: "v0.6"; previousScore: number; activeScoreVersion: "v0.7"; activeScore: number; localContext: number | null; localContextAvailableWeight: number; downBallotDemocraticOverperformance: number | null; houseDemocraticShare: number | null; presidentialDemocraticShare: number | null; houseMinusPresidentPercentagePoints: number | null; exactGeographyJoin: "at_large_statewide" | "not_yet_eligible"; evidenceConfidence: "research_fallback_exact_at_large" | "research_fallback_exact_at_large_official_fips_normalization" | "research_fallback_exact_at_large_partial_election_administration" | "not_available"; activationContextComponents: { inverseBallotsCastToCvap: number; inverseActiveRegistrationToCvap: null; downBallotDemocraticOverperformance: number; demographicOpportunity: number } | null; movementFromV06: number };
type V07ActiveProjection = { schema: "house-score-v07-active-projection-v1"; version: 1; methodology: { status: "active"; scope: "exact_at_large_geography_with_partial_component_renormalization"; minimumAvailableWeight: 0.6; directElectionAdministrationMeasureRequired: true; splitCountyAllocation: false; researchFallbackScoreInputs: true; winnerInference: false }; rows: V07ActiveRow[]; summary: { seats: 430; downBallotActiveSeats: 4; newlyActivatedSeats: 1; unchangedSeats: 429; normalizedFipsSeats: 1; partialComponentSeats: 1; routeChanges: 0; movementCapBreaches: 0 }; rowSetSha256: string; packageSha256: string };
type V08ActiveRow = { seatCycleId: string; districtLabel: string; incumbentParty: "Democratic" | "Republican"; qualifyingRoute: "deep_blue" | "aipac_supported_blue" | "republican_fringe_general"; previousScoreVersion: "v0.7"; previousScore: number; activeScoreVersion: "v0.8"; activeScore: number; previousPrimaryFeasibility: number | null; activePrimaryFeasibility: number | null; directPrimaryEvidence: boolean; primaryEvidenceId: string | null; primaryIdentityStatus: string | null; primaryGeographyStatus: string | null; incumbentPrimaryVotes: number | null; primaryContestVotes: number | null; incumbentPrimaryVoteShare: number | null; localContext: number | null; localContextAvailableWeight: number; downBallotDemocraticOverperformance: number | null; houseDemocraticShare: number | null; presidentialDemocraticShare: number | null; houseMinusPresidentPercentagePoints: number | null; structuralBaseline: number | null; movementFromV07: number; rowSha256: string };
type V08ActiveProjection = { schema: "house-score-v08-active-projection-v1"; version: 1; methodology: { status: "active"; primaryMetric: "one_hundred_minus_incumbent_vote_share_in_retained_2024_democratic_primary_contest"; unresolvedIdentityBehavior: "preserve_v07_score_and_inferred_primary_component"; sourceWinnerInference: false }; rows: V08ActiveRow[]; summary: { seats: 430; directPrimaryActiveSeats: 21; unresolvedPrimaryRows: 1; changedSeats: 20; unchangedSeats: 410; routeChanges: 0; movementCapBreaches: 0 }; rowSetSha256: string; packageSha256: string };
const cutoff = "2026-08-04";
const days = (start: string, end: string): number => (Date.parse(end) - Date.parse(start)) / 86_400_000;
const one = (value: number): number => Math.round(value * 10) / 10;
const marginLabel = (value: number): string => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
};
const factValue = (fact: FinanceFact): number | null => fact.kind === "value" ? fact.value : null;

export function cashVulnerabilityScore(cashOnHand: number): number {
  if (!Number.isFinite(cashOnHand)) throw new Error("HOUSE_PRIORITY_CASH_INVALID");
  if (cashOnHand <= 50_000) return 100;
  if (cashOnHand >= 5_000_000) return 0;
  return one(100 * (1 - Math.log(cashOnHand / 50_000) / Math.log(100)));
}

function financeRows(): Map<string, FinanceRow> {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "data/metadata/house-priority-finance-20260808-v1.json"), "utf8")) as FinanceProjection;
  const { projectionSha256, ...unsigned } = raw;
  const actual = createHash("sha256").update("dsa-seats:house-priority-finance-projection:v1\0").update(canonical(unsigned)).digest("hex");
  if (raw.schema !== "house-priority-finance-projection-v1" || raw.universe.observed !== 430 || raw.rows.length !== 430 || new Set(raw.rows.map((row) => row.seatCycleId)).size !== 430 || raw.summary.cashOnHandValues !== 427 || actual !== projectionSha256) throw new Error("HOUSE_PRIORITY_FINANCE_PROJECTION_INVALID");
  return new Map(raw.rows.map((row) => [row.seatCycleId, row]));
}

function csvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;
    if (char === '"') {
      if (quoted && input[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if (char === "\n" && !quoted) { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function republicanBriefs(finance: Map<string, FinanceRow>): PublicPriorityBrief[] {
  const root = process.cwd();
  const xml = readFileSync(join(root, "data/source/identity/house-member-data.xml"), "utf8");
  const congress = JSON.parse(readFileSync(join(root, "data/source/identity/congress-legislators-current-20260804.json"), "utf8")) as Legislator[];
  const election = csvRows(readFileSync(join(root, "data/source/elections/downballot-presidential-cd-2024.csv"), "utf8"));
  const margins = new Map<string, number>();
  const header = election.findIndex((row) => row[0] === "District" && row.includes("2024"));
  for (const row of election.slice(header + 2)) {
    if (!/^[A-Z]{2}-(?:AL|\d{2})$/.test(row[0] ?? "")) continue;
    margins.set(row[0]!, Number((row[8] ?? "").replace("%", "")));
  }
  if (margins.size !== 435) throw new Error("HOUSE_PRIORITY_PRESIDENTIAL_CLOSURE_INVALID");
  const byBio = new Map(congress.flatMap((person) => person.id?.bioguide ? [[person.id.bioguide, person] as const] : []));
  const tag = (block: string, name: string): string | null => block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1]?.trim() ?? null;
  const nonVoting = new Set(["AQ", "DC", "GU", "MP", "PR", "VI"]);
  const members = [...xml.matchAll(/<member>([\s\S]*?)<\/member>/g)]
    .map((match) => match[1]!)
    .filter((block) => tag(block, "party") === "R" && !nonVoting.has(tag(block, "statedistrict")!.slice(0, 2)));
  if (members.length !== 218) throw new Error("HOUSE_PRIORITY_REPUBLICAN_CLOSURE_INVALID");
  return members.map((block) => {
    const stateDistrict = tag(block, "statedistrict")!, stateCode = stateDistrict.slice(0, 2), districtCode = stateDistrict.slice(2);
    const bioguideId = tag(block, "bioguideID")!, officialHouseName = tag(block, "official-name")!;
    const person = byBio.get(bioguideId);
    if (!person?.bio?.birthday) throw new Error(`HOUSE_PRIORITY_IDENTITY_INVALID:${bioguideId}`);
    const terms = (person.terms ?? []).filter((term) => term.type === "rep" && term.start && term.end && term.state && term.district !== undefined);
    if (!terms.length) throw new Error(`HOUSE_PRIORITY_TENURE_INVALID:${bioguideId}`);
    const serviceHistory = terms.map((term) => ({ stateCode: term.state!, district: term.district!, start: term.start!, end: term.end!, currentAtCutoff: term.start! <= cutoff && cutoff < term.end! }));
    const cumulativeHouseServiceYears = one(serviceHistory.reduce((sum, term) => sum + days(term.start, term.currentAtCutoff ? cutoff : term.end), 0) / 365.2425);
    const districtChangeCount = new Set(serviceHistory.map((term) => `${term.stateCode}-${term.district}`)).size - 1;
    const electionKey = `${stateCode}-${districtCode === "00" ? "AL" : districtCode}`;
    const margin = margins.get(electionKey);
    if (margin === undefined) throw new Error(`HOUSE_PRIORITY_MARGIN_INVALID:${electionKey}`);
    const districtLabel = `${stateCode}-${districtCode === "00" ? "AL" : districtCode}`;
    const seatCycleId = `seat_house_${stateCode.toLowerCase()}_${districtCode === "00" ? "al" : districtCode.toLowerCase()}_current`;
    const financeRow = finance.get(seatCycleId);
    if (!financeRow || financeRow.incumbentParty !== "republican") throw new Error(`HOUSE_PRIORITY_FINANCE_JOIN_INVALID:${seatCycleId}`);
    const cash = factValue(financeRow.cashOnHand), receipts = factValue(financeRow.receipts), disbursements = factValue(financeRow.disbursements);
    const competitiveness = one(Math.max(0, Math.min(100, 100 - Math.max(0, -margin) * 4)));
    const cashVulnerability = cash === null ? null : cashVulnerabilityScore(cash);
    const combined = cashVulnerability === null ? competitiveness : one(0.75 * competitiveness + 0.25 * cashVulnerability);
    const score = one(combined * 0.7);
    return {
      rank: 0,
      seatCycleId,
      districtLabel, stateCode, districtCode,
      incumbentName: officialHouseName, officialHouseName, bioguideId,
      birthYear: Number(person.bio.birthday.slice(0, 4)), incumbentParty: "Republican" as const,
      provisionalTargetScore: score, baselineTargetScore: combined,
      formula: cashVulnerability === null ? "0.70 × Republican-held general-election competitiveness (finance unavailable)" : "0.70 × (0.75 × general-election competitiveness + 0.25 × cash vulnerability)",
      qualifyingRoute: "republican_fringe_general" as const,
      scoreDrivers: [
        { key: "general_election_competitiveness", label: "General-election fringe", score: competitiveness, coverage: 1, inferred: false, explanation: `The retained 2024 presidential result was ${marginLabel(margin)}. A tied district begins at 100 and each Republican margin point subtracts four points.` },
        { key: "primary_feasibility", label: "Democratic primary", score: null, coverage: 0, inferred: false, explanation: "Not applicable to this Republican-held general-election route; no Democratic-primary value is imputed." },
        { key: "aipac_support", label: "AIPAC support", score: null, coverage: 0, inferred: false, explanation: "Not used in this route because the retained candidate-level AIPAC model covers the Democratic incumbent field." },
        { key: "incumbent_alignment_gap", label: "Incumbent alignment", score: null, coverage: 0, inferred: false, explanation: "Not used in this route because the retained alignment trackers cover Democratic incumbents." },
        { key: "cash_vulnerability", label: "Cash vulnerability", score: cashVulnerability, coverage: cashVulnerability === null ? 0 : 1, inferred: false, explanation: cash === null ? "The published release reports no incumbent cash-on-hand value, so finance is omitted and the available route is not penalized." : `The published release reports $${Math.round(cash).toLocaleString("en-US")} cash on hand. The inverse log scale is 100 at $50,000 or less and 0 at $5 million or more.` },
      ],
      presidentialDemocraticMargin2024: margin, incumbentCashOnHand: cash, incumbentReceipts: receipts, incumbentDisbursements: disbursements, financeCoverageThrough: financeRow.coverageThrough,
      firstHouseServiceDate: serviceHistory[0]!.start, cumulativeHouseServiceYears, districtChangeCount, serviceHistory,
      scoreSummary: `${districtLabel} enters through the Republican-held fringe route at ${score.toFixed(1)}. The route is capped at 70 and combines 2024 general-election competitiveness${cashVulnerability === null ? "; incumbent finance is unavailable" : " with incumbent cash vulnerability"}.`,
      personSummary: `${officialHouseName} is the current Republican House member for ${districtLabel}. The retained congressional history records ${cumulativeHouseServiceYears.toFixed(1)} cumulative years of House service through the source cutoff.`,
      districtSummary: `${districtLabel} recorded a ${marginLabel(margin)} presidential margin in 2024.${cash === null ? " Incumbent cash on hand is not reported in the release." : ` The incumbent reported $${Math.round(cash).toLocaleString("en-US")} cash on hand through ${financeRow.coverageThrough}.`} This route surfaces potentially competitive Republican-held districts without inventing Democratic-primary, AIPAC, or alignment evidence.`,
      limitations: "This is a structural fringe screen, not a forecast, endorsement, candidate-quality assessment, or claim that a Democratic challenger is present.",
    };
  });
}

let cacheV03: PublicPriorityBrief[] | undefined;
export function housePriorityBriefsV03(): readonly PublicPriorityBrief[] {
  if (!cacheV03) {
    const finance = financeRows();
    const democrats: PublicPriorityBrief[] = priorityBriefs().briefs.map((row) => {
      const financeRow = finance.get(row.seatCycleId);
      if (!financeRow || financeRow.incumbentParty !== "democratic") throw new Error(`HOUSE_PRIORITY_FINANCE_JOIN_INVALID:${row.seatCycleId}`);
      const cash = factValue(financeRow.cashOnHand), receipts = factValue(financeRow.receipts), disbursements = factValue(financeRow.disbursements);
      const cashVulnerability = cash === null ? null : cashVulnerabilityScore(cash);
      const alignment = row.scoreDrivers.find((driver) => driver.key === "incumbent_alignment_gap")?.score;
      if (alignment === undefined || alignment === null) throw new Error(`HOUSE_PRIORITY_ALIGNMENT_INVALID:${row.seatCycleId}`);
      const score = cashVulnerability === null ? one((0.65 * row.baselineTargetScore + 0.2 * alignment) / 0.85) : one(0.65 * row.baselineTargetScore + 0.2 * alignment + 0.15 * cashVulnerability);
      return {
        ...row,
        incumbentParty: "Democratic" as const,
        provisionalTargetScore: score,
        formula: cashVulnerability === null ? "available 0.65 structural + 0.20 alignment weights renormalized (finance unavailable)" : "0.65 × structural baseline + 0.20 × incumbent alignment gap + 0.15 × cash vulnerability",
        scoreDrivers: [...row.scoreDrivers, { key: "cash_vulnerability", label: "Cash vulnerability", score: cashVulnerability, coverage: cashVulnerability === null ? 0 : 1, inferred: false, explanation: cash === null ? "The published release reports no incumbent cash-on-hand value, so finance is omitted and the available structural/alignment weights are renormalized." : `The published release reports $${Math.round(cash).toLocaleString("en-US")} cash on hand. The inverse log scale is 100 at $50,000 or less and 0 at $5 million or more.` }],
        incumbentCashOnHand: cash,
        incumbentReceipts: receipts,
        incumbentDisbursements: disbursements,
        financeCoverageThrough: financeRow.coverageThrough,
        scoreSummary: `${row.districtLabel} scores ${score.toFixed(1)} on the expanded model: ${row.qualifyingRoute === "aipac_supported_blue" ? "AIPAC-supported blue" : "deep-blue"} structure, incumbent alignment, and${cashVulnerability === null ? " no available" : " reported"} cash-on-hand evidence.`,
        districtSummary: `${row.districtSummary}${cash === null ? " Incumbent cash on hand is not reported in the release." : ` The incumbent reported $${Math.round(cash).toLocaleString("en-US")} cash on hand through ${financeRow.coverageThrough}.`}`,
      };
    });
    cacheV03 = [...democrats, ...republicanBriefs(finance)]
      .sort((left, right) => right.provisionalTargetScore - left.provisionalTargetScore || left.seatCycleId.localeCompare(right.seatCycleId))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }
  return cacheV03;
}

function v04ActiveRows(): Map<string, V04ActiveRow> {
  const path = "data/metadata/house-score-v04-active-projection-v1.json";
  const bytes = readFileSync(join(process.cwd(), path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  const lock = JSON.parse(readFileSync(join(process.cwd(), "data/source-lock.json"), "utf8")) as { entries: Array<{ id?: unknown; url?: unknown; retainedPath?: unknown; retainedStatus?: unknown; byteSize?: unknown; sha256?: unknown; kind?: unknown; parentIds?: unknown }> };
  const entries = lock.entries.filter((entry) => entry.id === "house-score-v04-active-projection-v1");
  if (bytes.length !== 272_726 || digest !== "8bd0a866867330a16f4fd2e5e1eea37d7a06f0650671e55831317ceb9941cc80" || entries.length !== 1 || entries[0]!.url !== "urn:dsa-seats:house-score-v04-active-projection:v1:2026-08-09" || entries[0]!.retainedPath !== path || entries[0]!.retainedStatus !== "retained" || entries[0]!.byteSize !== bytes.length || entries[0]!.sha256 !== digest || entries[0]!.kind !== "derived_artifact" || JSON.stringify(entries[0]!.parentIds) !== JSON.stringify(["house-score-v04-shadow-projection-v1"])) throw new Error("HOUSE_PRIORITY_V04_SOURCE_INVALID");
  const value = JSON.parse(bytes.toString("utf8")) as V04ActiveProjection;
  if (value.schema !== "house-score-v04-active-projection-v1" || value.version !== 1 || value.activationPolicy.status !== "active" || value.activationPolicy.scope !== "exact_at_large_geography_only" || value.activationPolicy.splitCountyAllocation !== false || value.activationPolicy.researchFallbackScoreInputs !== false || value.summary.seats !== 430 || value.summary.localContextActiveSeats !== 3 || value.summary.unchangedSeats !== 427 || value.summary.routeChanges !== 0 || value.summary.movementCapBreaches !== 0 || value.rows.length !== 430 || new Set(value.rows.map((row) => row.seatCycleId)).size !== 430 || value.rowSetSha256 !== "6ea048a3f259855ea94bbdb0b4682965152ef612f01eb9a24061305cfc4529c1" || value.packageSha256 !== "890685b51d73bc146e727ee21d2bd4d94c52a0686a0651c9d33ede54a0c868f0") throw new Error("HOUSE_PRIORITY_V04_PROJECTION_INVALID");
  return new Map(value.rows.map((row) => [row.seatCycleId, row]));
}

function v05ActiveRows(): Map<string, V05ActiveRow> {
  const path = "data/metadata/house-score-v05-active-projection-v1.json";
  const bytes = readFileSync(join(process.cwd(), path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  const lock = JSON.parse(readFileSync(join(process.cwd(), "data/source-lock.json"), "utf8")) as { entries: Array<{ id?: unknown; url?: unknown; retainedPath?: unknown; retainedStatus?: unknown; byteSize?: unknown; sha256?: unknown; kind?: unknown; parentIds?: unknown }> };
  const entries = lock.entries.filter((entry) => entry.id === "house-score-v05-active-projection-v1");
  const parentIds = ["house-score-v04-active-projection-v1", "house-score-v04-shadow-projection-v1", "rapid-county-house-results-projection-v1", "downballot-presidential-cd-2024-csv", "rapid-at-large-cd119-county-universe-v1"];
  if (bytes.length !== 431_813 || digest !== "ffca4e473569876bc54044d778e7d804308b485f00034f5c86e56c00a597df74" || entries.length !== 1 || entries[0]!.url !== "urn:dsa-seats:house-score-v05-active-projection:v1:2026-08-09" || entries[0]!.retainedPath !== path || entries[0]!.retainedStatus !== "retained" || entries[0]!.byteSize !== bytes.length || entries[0]!.sha256 !== digest || entries[0]!.kind !== "derived_artifact" || JSON.stringify(entries[0]!.parentIds) !== JSON.stringify(parentIds)) throw new Error("HOUSE_PRIORITY_V05_SOURCE_INVALID");
  const value = JSON.parse(bytes.toString("utf8")) as V05ActiveProjection;
  if (value.schema !== "house-score-v05-active-projection-v1" || value.version !== 1 || value.methodology.status !== "active" || value.methodology.scope !== "exact_at_large_geography_only" || value.methodology.splitCountyAllocation !== false || value.methodology.researchFallbackScoreInputs !== true || value.methodology.winnerInference !== false || value.summary.seats !== 430 || value.summary.downBallotActiveSeats !== 2 || value.summary.unchangedSeats !== 428 || value.summary.geographyExcludedSeats !== 1 || value.summary.routeChanges !== 0 || value.summary.movementCapBreaches !== 0 || value.rows.length !== 430 || new Set(value.rows.map((row) => row.seatCycleId)).size !== 430 || value.rowSetSha256 !== "7500913c3255028140715c4baedef979a79461841e7d6ea37f9f3f3292c717c6" || value.packageSha256 !== "33ec23d4d41476c825c4bcf7df8e627411147719a80d37b59e07bbb0ef640dcd") throw new Error("HOUSE_PRIORITY_V05_PROJECTION_INVALID");
  return new Map(value.rows.map((row) => [row.seatCycleId, row]));
}

function v06ActiveRows(): Map<string, V06ActiveRow> {
  const path = "data/metadata/house-score-v06-active-projection-v1.json";
  const bytes = readFileSync(join(process.cwd(), path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  const lock = JSON.parse(readFileSync(join(process.cwd(), "data/source-lock.json"), "utf8")) as { entries: Array<{ id?: unknown; url?: unknown; retainedPath?: unknown; retainedStatus?: unknown; byteSize?: unknown; sha256?: unknown; kind?: unknown; parentIds?: unknown }> };
  const entries = lock.entries.filter((entry) => entry.id === "house-score-v06-active-projection-v1");
  const parentIds = ["house-score-v05-active-projection-v1", "house-score-v04-shadow-projection-v1", "rapid-county-house-results-projection-v1", "rapid-south-dakota-county-fips-normalization-v1", "downballot-presidential-cd-2024-csv", "rapid-at-large-cd119-county-universe-v1"];
  if (bytes.length !== 456_292 || digest !== "70a67d1bc6d6e85343868ce25afd5efb53148061cee82c9ca890a6479e0a7a02" || entries.length !== 1 || entries[0]!.url !== "urn:dsa-seats:house-score-v06-active-projection:v1:2026-08-09" || entries[0]!.retainedPath !== path || entries[0]!.retainedStatus !== "retained" || entries[0]!.byteSize !== bytes.length || entries[0]!.sha256 !== digest || entries[0]!.kind !== "derived_artifact" || JSON.stringify(entries[0]!.parentIds) !== JSON.stringify(parentIds)) throw new Error("HOUSE_PRIORITY_V06_SOURCE_INVALID");
  const value = JSON.parse(bytes.toString("utf8")) as V06ActiveProjection;
  if (value.schema !== "house-score-v06-active-projection-v1" || value.version !== 1 || value.methodology.status !== "active" || value.methodology.scope !== "exact_at_large_geography_with_official_identifier_normalization" || value.methodology.countyIdentifierNormalization !== "only_official_census_documented_46113_to_46102_change" || value.methodology.splitCountyAllocation !== false || value.methodology.researchFallbackScoreInputs !== true || value.methodology.winnerInference !== false || value.summary.seats !== 430 || value.summary.downBallotActiveSeats !== 3 || value.summary.newlyActivatedSeats !== 1 || value.summary.unchangedSeats !== 429 || value.summary.normalizedFipsSeats !== 1 || value.summary.routeChanges !== 0 || value.summary.movementCapBreaches !== 0 || value.rows.length !== 430 || new Set(value.rows.map((row) => row.seatCycleId)).size !== 430 || value.rowSetSha256 !== "d5415153a54c2827941605a61dc691bce43321df8cbfe62893bf06b167bb8f4f" || value.packageSha256 !== "b20c1572d435126646ac3e41ab91477ad3a0372b10728854286d672bb98f0342") throw new Error("HOUSE_PRIORITY_V06_PROJECTION_INVALID");
  return new Map(value.rows.map((row) => [row.seatCycleId, row]));
}

function v07ActiveRows(): Map<string, V07ActiveRow> {
  const path = "data/metadata/house-score-v07-active-projection-v1.json";
  const bytes = readFileSync(join(process.cwd(), path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  const lock = JSON.parse(readFileSync(join(process.cwd(), "data/source-lock.json"), "utf8")) as { entries: Array<{ id?: unknown; url?: unknown; retainedPath?: unknown; retainedStatus?: unknown; byteSize?: unknown; sha256?: unknown; kind?: unknown; parentIds?: unknown }> };
  const entries = lock.entries.filter((entry) => entry.id === "house-score-v07-active-projection-v1");
  const parentIds = ["house-score-v06-active-projection-v1", "rapid-county-demographics-projection-v1", "rapid-county-election-context-projection-v1", "rapid-county-cvap-projection-v1", "rapid-county-house-results-projection-v1", "downballot-presidential-cd-2024-csv", "rapid-at-large-cd119-county-universe-v1"];
  if (bytes.length !== 431_952 || digest !== "db9552a2b5e8b0be19f8f6ba0678f4f6a21f6b2534fc85876bc2dfb679641f93" || entries.length !== 1 || entries[0]!.url !== "urn:dsa-seats:house-score-v07-active-projection:v1:2026-08-09" || entries[0]!.retainedPath !== path || entries[0]!.retainedStatus !== "retained" || entries[0]!.byteSize !== bytes.length || entries[0]!.sha256 !== digest || entries[0]!.kind !== "derived_artifact" || JSON.stringify(entries[0]!.parentIds) !== JSON.stringify(parentIds)) throw new Error("HOUSE_PRIORITY_V07_SOURCE_INVALID");
  const value = JSON.parse(bytes.toString("utf8")) as V07ActiveProjection;
  if (value.schema !== "house-score-v07-active-projection-v1" || value.version !== 1 || value.methodology.status !== "active" || value.methodology.scope !== "exact_at_large_geography_with_partial_component_renormalization" || value.methodology.minimumAvailableWeight !== 0.6 || value.methodology.directElectionAdministrationMeasureRequired !== true || value.methodology.splitCountyAllocation !== false || value.methodology.researchFallbackScoreInputs !== true || value.methodology.winnerInference !== false || value.summary.seats !== 430 || value.summary.downBallotActiveSeats !== 4 || value.summary.newlyActivatedSeats !== 1 || value.summary.unchangedSeats !== 429 || value.summary.normalizedFipsSeats !== 1 || value.summary.partialComponentSeats !== 1 || value.summary.routeChanges !== 0 || value.summary.movementCapBreaches !== 0 || value.rows.length !== 430 || new Set(value.rows.map((row) => row.seatCycleId)).size !== 430 || value.rowSetSha256 !== "e2aaf539ff8a3f976f08e09bdc0459a57d6a31d6b9984b3118e57f3d29607780" || value.packageSha256 !== "92c62343504d61c526422ebf2f2dad284bd813ff5f626ea2a22916ca133b745a") throw new Error("HOUSE_PRIORITY_V07_PROJECTION_INVALID");
  return new Map(value.rows.map((row) => [row.seatCycleId, row]));
}

function v08ActiveRows(): Map<string, V08ActiveRow> {
  const path = "data/metadata/house-score-v08-active-projection-v1.json";
  const bytes = readFileSync(join(process.cwd(), path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  const lock = JSON.parse(readFileSync(join(process.cwd(), "data/source-lock.json"), "utf8")) as { entries: Array<{ id?: unknown; url?: unknown; retainedPath?: unknown; retainedStatus?: unknown; byteSize?: unknown; sha256?: unknown; kind?: unknown; parentIds?: unknown }> };
  const entries = lock.entries.filter((entry) => entry.id === "house-score-v08-active-projection-v1");
  const parentIds = ["house-score-v07-active-projection-v1", "rapid-house-primary-2024-incumbent-evidence-v1"];
  if (bytes.length !== 511_918 || digest !== "76fcb690ccb7abfff5c8a8b6dca844cee2da688417250192b495c5e127e1328d" || entries.length !== 1 || entries[0]!.url !== "urn:dsa-seats:house-score-v08-active-projection:v1:2026-08-09" || entries[0]!.retainedPath !== path || entries[0]!.retainedStatus !== "retained" || entries[0]!.byteSize !== bytes.length || entries[0]!.sha256 !== digest || entries[0]!.kind !== "derived_artifact" || JSON.stringify(entries[0]!.parentIds) !== JSON.stringify(parentIds)) throw new Error("HOUSE_PRIORITY_V08_SOURCE_INVALID");
  const value = JSON.parse(bytes.toString("utf8")) as V08ActiveProjection;
  if (value.schema !== "house-score-v08-active-projection-v1" || value.version !== 1 || value.methodology.status !== "active" || value.methodology.primaryMetric !== "one_hundred_minus_incumbent_vote_share_in_retained_2024_democratic_primary_contest" || value.methodology.unresolvedIdentityBehavior !== "preserve_v07_score_and_inferred_primary_component" || value.methodology.sourceWinnerInference !== false || value.summary.seats !== 430 || value.summary.directPrimaryActiveSeats !== 21 || value.summary.unresolvedPrimaryRows !== 1 || value.summary.changedSeats !== 20 || value.summary.unchangedSeats !== 410 || value.summary.routeChanges !== 0 || value.summary.movementCapBreaches !== 0 || value.rows.length !== 430 || new Set(value.rows.map((row) => row.seatCycleId)).size !== 430 || value.rowSetSha256 !== "931f080522cc5a383d07402282c259dbaaaf429a6fe09c8399fe3adb578624b1" || value.packageSha256 !== "79b154e4e954d3f8327307e8a977b77e77fc59a311114193be22cff5e0ec913a") throw new Error("HOUSE_PRIORITY_V08_PROJECTION_INVALID");
  return new Map(value.rows.map((row) => [row.seatCycleId, row]));
}

let cache: PublicPriorityBrief[] | undefined;
export function housePriorityBriefs(): readonly PublicPriorityBrief[] {
  if (!cache) {
    const active = v04ActiveRows();
    const base = housePriorityBriefsV03();
    if (active.size !== base.length) throw new Error("HOUSE_PRIORITY_V04_CLOSURE_INVALID");
    cache = base.map((brief) => {
      const row = active.get(brief.seatCycleId);
      if (!row || row.districtLabel !== brief.districtLabel || row.previousScoreVersion !== "v0.3" || row.previousScore !== brief.provisionalTargetScore || row.activeScoreVersion !== "v0.4") throw new Error(`HOUSE_PRIORITY_V04_JOIN_INVALID:${brief.seatCycleId}`);
      if (row.localContext === null) {
        if (row.activeScore !== brief.provisionalTargetScore || row.movement !== 0) throw new Error(`HOUSE_PRIORITY_V04_MISSING_INVALID:${brief.seatCycleId}`);
        return brief;
      }
      if (row.exactGeographyJoin !== "at_large_statewide" || row.localContextAvailableWeight < 0.6 || row.movement !== one(row.activeScore - brief.provisionalTargetScore)) throw new Error(`HOUSE_PRIORITY_V04_ELIGIBLE_INVALID:${brief.seatCycleId}`);
      const explanation = `Exact at-large county context contributes ${row.localContext.toFixed(1)} from available turnout, registration, and demographic evidence (${Math.round(row.localContextAvailableWeight * 100)}% of the local-context component weight).`;
      return {
        ...brief,
        provisionalTargetScore: row.activeScore,
        formula: `${brief.formula}; v0.4 adds exact local context inside the structural route`,
        scoreDrivers: [...brief.scoreDrivers, { key: "local_context", label: "Local context", score: row.localContext, coverage: row.localContextAvailableWeight, inferred: false, explanation }],
        scoreSummary: `${brief.scoreSummary} The active v0.4 model adds exact at-large local context, moving the score ${row.movement >= 0 ? "+" : ""}${row.movement.toFixed(1)} to ${row.activeScore.toFixed(1)}.`,
        districtSummary: `${brief.districtSummary} Exact statewide county coverage adds turnout, registration, and demographic context without allocating split counties.`,
      };
    });
    const v05 = v05ActiveRows();
    if (v05.size !== cache.length) throw new Error("HOUSE_PRIORITY_V05_CLOSURE_INVALID");
    cache = cache.map((brief) => {
      const row = v05.get(brief.seatCycleId);
      if (!row || row.districtLabel !== brief.districtLabel || row.previousScoreVersion !== "v0.4" || row.previousScore !== brief.provisionalTargetScore || row.activeScoreVersion !== "v0.5") throw new Error(`HOUSE_PRIORITY_V05_JOIN_INVALID:${brief.seatCycleId}`);
      if (row.downBallotDemocraticOverperformance === null) {
        if (row.activeScore !== brief.provisionalTargetScore || row.movementFromV04 !== 0) throw new Error(`HOUSE_PRIORITY_V05_MISSING_INVALID:${brief.seatCycleId}`);
        return brief;
      }
      if (row.exactGeographyJoin !== "at_large_statewide" || row.evidenceConfidence !== "research_fallback_exact_at_large" || row.localContext === null || row.localContextAvailableWeight !== 1 || row.houseDemocraticShare === null || row.presidentialDemocraticShare === null || row.houseMinusPresidentPercentagePoints === null || row.movementFromV04 !== one(row.activeScore - brief.provisionalTargetScore)) throw new Error(`HOUSE_PRIORITY_V05_ELIGIBLE_INVALID:${brief.seatCycleId}`);
      const localDriver = brief.scoreDrivers.find((driver) => driver.key === "local_context");
      if (!localDriver) throw new Error(`HOUSE_PRIORITY_V05_LOCAL_DRIVER_MISSING:${brief.seatCycleId}`);
      const direction = row.houseMinusPresidentPercentagePoints >= 0 ? "+" : "";
      const explanation = `Exact at-large local context is ${row.localContext.toFixed(1)} with all component weights present. The research-fallback 2024 House Democratic candidate share was ${row.houseDemocraticShare.toFixed(2)}% versus ${row.presidentialDemocraticShare.toFixed(2)}% for Harris (${direction}${row.houseMinusPresidentPercentagePoints.toFixed(2)} points); this becomes a ${row.downBallotDemocraticOverperformance.toFixed(1)} down-ballot component. No winner is inferred.`;
      return {
        ...brief,
        provisionalTargetScore: row.activeScore,
        formula: `${brief.formula}; v0.5 fills the down-ballot local-context weight for an exact at-large research-fallback join`,
        scoreDrivers: brief.scoreDrivers.map((driver) => driver.key === "local_context" ? { ...driver, score: row.localContext, coverage: 1, inferred: true, explanation } : driver),
        scoreSummary: `${brief.scoreSummary} V0.5 adds the exact at-large House-versus-presidential comparison, moving the score ${row.movementFromV04 >= 0 ? "+" : ""}${row.movementFromV04.toFixed(1)} to ${row.activeScore.toFixed(1)}.`,
        districtSummary: `${brief.districtSummary} The retained 2024 House Democratic candidate share ran ${direction}${row.houseMinusPresidentPercentagePoints.toFixed(2)} points versus Harris; this is research-fallback evidence, not an official canvass or winner claim.`,
      };
    });
    const v06 = v06ActiveRows();
    if (v06.size !== cache.length) throw new Error("HOUSE_PRIORITY_V06_CLOSURE_INVALID");
    cache = cache.map((brief) => {
      const row = v06.get(brief.seatCycleId);
      if (!row || row.districtLabel !== brief.districtLabel || row.previousScoreVersion !== "v0.5" || row.previousScore !== brief.provisionalTargetScore || row.activeScoreVersion !== "v0.6") throw new Error(`HOUSE_PRIORITY_V06_JOIN_INVALID:${brief.seatCycleId}`);
      if (row.movementFromV05 === 0) {
        if (row.activeScore !== brief.provisionalTargetScore) throw new Error(`HOUSE_PRIORITY_V06_UNCHANGED_INVALID:${brief.seatCycleId}`);
        return brief;
      }
      if (row.districtLabel !== "SD-AL" || row.exactGeographyJoin !== "at_large_statewide" || row.evidenceConfidence !== "research_fallback_exact_at_large_official_fips_normalization" || !row.officialCountyFipsNormalizationApplied || row.localContext === null || row.localContextAvailableWeight !== 1 || row.downBallotDemocraticOverperformance === null || row.houseDemocraticShare === null || row.presidentialDemocraticShare === null || row.houseMinusPresidentPercentagePoints === null || row.movementFromV05 !== one(row.activeScore - brief.provisionalTargetScore)) throw new Error(`HOUSE_PRIORITY_V06_ELIGIBLE_INVALID:${brief.seatCycleId}`);
      const localDriver = brief.scoreDrivers.find((driver) => driver.key === "local_context");
      if (!localDriver) throw new Error(`HOUSE_PRIORITY_V06_LOCAL_DRIVER_MISSING:${brief.seatCycleId}`);
      const direction = row.houseMinusPresidentPercentagePoints >= 0 ? "+" : "";
      const explanation = `Exact at-large local context is ${row.localContext.toFixed(1)} with all component weights present. The retained 2024 House Democratic candidate share was ${row.houseDemocraticShare.toFixed(2)}% versus ${row.presidentialDemocraticShare.toFixed(2)}% for Harris (${direction}${row.houseMinusPresidentPercentagePoints.toFixed(2)} points), after the official Census 46113-to-46102 county-code normalization; this becomes a ${row.downBallotDemocraticOverperformance.toFixed(1)} down-ballot component. No winner is inferred.`;
      return {
        ...brief,
        provisionalTargetScore: row.activeScore,
        formula: `${brief.formula}; v0.6 adds the officially documented county-code normalization for SD-AL`,
        scoreDrivers: brief.scoreDrivers.map((driver) => driver.key === "local_context" ? { ...driver, score: row.localContext, coverage: 1, inferred: true, explanation } : driver),
        scoreSummary: `${brief.scoreSummary} V0.6 closes the South Dakota county identifier with Census authority, moving the score ${row.movementFromV05 >= 0 ? "+" : ""}${row.movementFromV05.toFixed(1)} to ${row.activeScore.toFixed(1)}.`,
        districtSummary: `${brief.districtSummary} The retained 2024 House Democratic candidate share ran ${direction}${row.houseMinusPresidentPercentagePoints.toFixed(2)} points versus Harris after normalizing obsolete Shannon County FIPS 46113 to current Oglala Lakota County 46102; this remains research-fallback election evidence, not an official canvass or winner claim.`,
      };
    });
    const v07 = v07ActiveRows();
    if (v07.size !== cache.length) throw new Error("HOUSE_PRIORITY_V07_CLOSURE_INVALID");
    cache = cache.map((brief) => {
      const row = v07.get(brief.seatCycleId);
      if (!row || row.districtLabel !== brief.districtLabel || row.previousScoreVersion !== "v0.6" || row.previousScore !== brief.provisionalTargetScore || row.activeScoreVersion !== "v0.7") throw new Error(`HOUSE_PRIORITY_V07_JOIN_INVALID:${brief.seatCycleId}`);
      if (row.movementFromV06 === 0) {
        if (row.activeScore !== brief.provisionalTargetScore) throw new Error(`HOUSE_PRIORITY_V07_UNCHANGED_INVALID:${brief.seatCycleId}`);
        return brief;
      }
      if (row.districtLabel !== "ND-AL" || row.exactGeographyJoin !== "at_large_statewide" || row.evidenceConfidence !== "research_fallback_exact_at_large_partial_election_administration" || row.localContext !== 63.3 || row.localContextAvailableWeight !== 0.7 || row.downBallotDemocraticOverperformance !== 48 || row.houseDemocraticShare !== 30.36 || row.presidentialDemocraticShare !== 30.77 || row.houseMinusPresidentPercentagePoints !== -0.41 || row.activationContextComponents?.inverseBallotsCastToCvap !== 69.08 || row.activationContextComponents.inverseActiveRegistrationToCvap !== null || row.activationContextComponents.demographicOpportunity !== 70.61 || row.movementFromV06 !== one(row.activeScore - brief.provisionalTargetScore)) throw new Error(`HOUSE_PRIORITY_V07_ELIGIBLE_INVALID:${brief.seatCycleId}`);
      const direction = row.houseMinusPresidentPercentagePoints >= 0 ? "+" : "";
      const explanation = `Exact at-large local context is ${row.localContext.toFixed(1)} from 70% of the component weight: county ballots relative to CVAP, the House-versus-presidential comparison, and demographics. Active-registration values are unavailable and receive no imputed score. The research-fallback 2024 House Democratic candidate share was ${row.houseDemocraticShare.toFixed(2)}% versus ${row.presidentialDemocraticShare.toFixed(2)}% for Harris (${direction}${row.houseMinusPresidentPercentagePoints.toFixed(2)} points). No winner is inferred.`;
      return {
        ...brief,
        provisionalTargetScore: row.activeScore,
        formula: `${brief.formula}; v0.7 activates exact ND-AL county context by renormalizing the available 70% local-component weight`,
        scoreDrivers: [...brief.scoreDrivers, { key: "local_context", label: "Local context", score: row.localContext, coverage: row.localContextAvailableWeight, inferred: true, explanation }],
        scoreSummary: `${brief.scoreSummary} V0.7 adds exact North Dakota county context at 70% evidence coverage, moving the score ${row.movementFromV06 >= 0 ? "+" : ""}${row.movementFromV06.toFixed(1)} to ${row.activeScore.toFixed(1)}.`,
        districtSummary: `${brief.districtSummary} The retained 2024 House Democratic candidate share ran ${direction}${row.houseMinusPresidentPercentagePoints.toFixed(2)} points versus Harris; ballots/CVAP and demographics complete the 70% local-evidence threshold, while registration remains missing.`,
      };
    });
    const v08 = v08ActiveRows();
    if (v08.size !== cache.length) throw new Error("HOUSE_PRIORITY_V08_CLOSURE_INVALID");
    cache = cache.map((brief) => {
      const row = v08.get(brief.seatCycleId);
      if (!row || row.districtLabel !== brief.districtLabel || row.previousScoreVersion !== "v0.7" || row.previousScore !== brief.provisionalTargetScore || row.activeScoreVersion !== "v0.8") throw new Error(`HOUSE_PRIORITY_V08_JOIN_INVALID:${brief.seatCycleId}`);
      if (!row.directPrimaryEvidence) {
        if (row.activeScore !== brief.provisionalTargetScore || row.movementFromV07 !== 0) throw new Error(`HOUSE_PRIORITY_V08_UNCHANGED_INVALID:${brief.seatCycleId}`);
        return brief;
      }
      if (brief.incumbentParty !== "Democratic" || row.activePrimaryFeasibility === null || row.primaryEvidenceId === null || row.primaryIdentityStatus === null || row.primaryGeographyStatus !== "exact_cd119_session_and_district_key" || row.incumbentPrimaryVotes === null || row.primaryContestVotes === null || row.incumbentPrimaryVoteShare === null || row.structuralBaseline === null || row.movementFromV07 !== one(row.activeScore - brief.provisionalTargetScore)) throw new Error(`HOUSE_PRIORITY_V08_ELIGIBLE_INVALID:${brief.seatCycleId}`);
      const primaryExplanation = `The retained official 2024 Democratic primary reports ${row.incumbentPrimaryVotes.toLocaleString("en-US")} incumbent votes out of ${row.primaryContestVotes.toLocaleString("en-US")} contest votes (${row.incumbentPrimaryVoteShare.toFixed(1)}%). Primary feasibility is the inverse share, ${row.activePrimaryFeasibility.toFixed(1)}. The candidate identity and CD119 district key are bound; no winner is inferred.`;
      return {
        ...brief,
        provisionalTargetScore: row.activeScore,
        baselineTargetScore: row.structuralBaseline,
        formula: `${brief.formula}; v0.8 replaces inferred primary feasibility with 100 minus the directly linked 2024 incumbent vote share`,
        scoreDrivers: brief.scoreDrivers.map((driver) => driver.key === "primary_feasibility" ? { ...driver, score: row.activePrimaryFeasibility, coverage: 1, inferred: false, explanation: primaryExplanation } : driver),
        scoreSummary: `${brief.scoreSummary} V0.8 replaces the inferred primary component with direct 2024 contest evidence, moving the score ${row.movementFromV07 >= 0 ? "+" : ""}${row.movementFromV07.toFixed(1)} to ${row.activeScore.toFixed(1)}.`,
        districtSummary: `${brief.districtSummary} The directly linked 2024 Democratic primary gives the incumbent ${row.incumbentPrimaryVoteShare.toFixed(1)}% of retained contest votes; this changes primary feasibility without making a winner or nomination claim.`,
      };
    }).sort((left, right) => right.provisionalTargetScore - left.provisionalTargetScore || left.seatCycleId.localeCompare(right.seatCycleId)).map((row, index) => ({ ...row, rank: index + 1 }));
  }
  return cache;
}

export function housePriorityBrief(id: string): PublicPriorityBrief | undefined {
  return housePriorityBriefs().find((row) => row.seatCycleId === id);
}

export const formatPartisanMargin = marginLabel;
