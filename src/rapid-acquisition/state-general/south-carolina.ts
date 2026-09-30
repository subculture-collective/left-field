import type { StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { parseClaritySummary } from "./clarity";

/**
 * South Carolina Election Commission, 2024 general election Clarity summary.
 * All 124 House and 46 Senate seats were on the 2024 ballot. Contest names
 * read "State  House of Representatives, District  1 (Vote For 1)" with
 * irregular spacing; candidate names carry a party prefix ("REP Thomas C
 * Alexander") that duplicates the party column and is removed. Every contest
 * has a "Write-In" line with party NON.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "sc-2024-general-clarity-summary-zip", url: "https://www.enr-scvotes.org/SC/122436/359624/reports/summary.zip", path: "data/source/rapid/state-general/sc/2024-general-clarity-summary.zip", cycleYear: 2024, electionDate: "2024-11-05", note: "124 House and 46 Senate contests." },
];

export const SOUTH_CAROLINA_GENERAL: StateGeneralAdapter = {
  stateCode: "SC",
  authority: "South Carolina Election Commission, 2024 general election results (Clarity ENR)",
  sources: SOURCES,
  expectedContests: { "sc-2024-general-clarity-summary-zip": 170 },
  parse: (bytes) => parseClaritySummary(bytes, (contest) => {
    const match = contest.match(/^State (House of Representatives|Senate), District (\d+) \(Vote For (\d+)\)$/);
    return match ? { chamber: match[1] === "Senate" ? "upper" : "lower", district: String(Number(match[2])), seats: Number(match[3]) } : null;
  }, { stripPartyPrefix: true }),
};
