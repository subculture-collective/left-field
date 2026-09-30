import type { StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseClaritySummary } from "./clarity";

/**
 * Iowa Secretary of State, general election Clarity summaries (served on
 * electionresults.iowa.gov). Contests read "State Representative District 1
 * (Vote For 1)" and "State Senator District 2 (Vote For 1)"; each has a
 * "Write-in" line with no party. All 100 House districts are elected every
 * two years. After redistricting, 2022 elected the odd Senate districts to
 * four-year terms and some even districts to two-year terms; the 25 even
 * districts elected in 2024 take their 2024 contest.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "ia-2024-general-clarity-summary-zip", url: "https://electionresults.iowa.gov/IA/122322/356043/reports/summary.zip", path: "data/source/rapid/state-general/ia/2024-general-clarity-summary.zip", cycleYear: 2024, electionDate: "2024-11-05", note: "100 House and 25 Senate contests." },
  { id: "ia-2022-general-clarity-summary-zip", url: "https://electionresults.iowa.gov/IA/115641/316303/reports/summary.zip", path: "data/source/rapid/state-general/ia/2022-general-clarity-summary.zip", cycleYear: 2022, electionDate: "2022-11-08", note: "100 House (superseded by 2024) and 34 Senate contests." },
];

export const IOWA_GENERAL: StateGeneralAdapter = {
  stateCode: "IA",
  authority: "Iowa Secretary of State, general election results (Clarity ENR)",
  sources: SOURCES,
  expectedContests: { "ia-2024-general-clarity-summary-zip": 125, "ia-2022-general-clarity-summary-zip": 134 },
  parse: (bytes) => parseClaritySummary(bytes, (contest) => {
    const match = contest.match(/^State (Representative|Senator) District (\d+) \(Vote For (\d+)\)$/);
    return match ? { chamber: match[1] === "Senator" ? "upper" : "lower", district: String(Number(match[2])), seats: Number(match[3]) } : null;
  }),
};
