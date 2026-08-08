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

let cache: PublicPriorityBrief[] | undefined;
export function housePriorityBriefs(): readonly PublicPriorityBrief[] {
  if (!cache) {
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
    cache = [...democrats, ...republicanBriefs(finance)]
      .sort((left, right) => right.provisionalTargetScore - left.provisionalTargetScore || left.seatCycleId.localeCompare(right.seatCycleId))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }
  return cache;
}

export function housePriorityBrief(id: string): PublicPriorityBrief | undefined {
  return housePriorityBriefs().find((row) => row.seatCycleId === id);
}

export const formatPartisanMargin = marginLabel;
