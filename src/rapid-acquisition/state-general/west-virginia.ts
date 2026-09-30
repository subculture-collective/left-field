import type { StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { ordinal, parseClaritySummary } from "./clarity";

/**
 * West Virginia Secretary of State, general election Clarity summaries.
 * All 100 House of Delegates districts are elected every two years; the
 * Senate's 17 districts elect two members on staggered four-year terms, one
 * seat each cycle, so 2024 and 2022 together cover both members of every
 * Senate district. The two members of a Senate district were elected in
 * different years; each holder is matched to the contest naming them, and a
 * holder named in neither takes the one no colleague matched. Contest names
 * read "HOUSE OF DELEGATES, 1st District (Vote For 1)" and "STATE SENATOR,
 * 1st Senatorial District (Vote For 1)"; candidate names are upper case.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "wv-2024-general-clarity-summary-zip", url: "https://results.enr.clarityelections.com/WV/122766/356048/reports/summary.zip", path: "data/source/rapid/state-general/wv/2024-general-clarity-summary.zip", cycleYear: 2024, electionDate: "2024-11-05", note: "100 House of Delegates and 17 Senate contests." },
  { id: "wv-2022-general-clarity-summary-zip", url: "https://results.enr.clarityelections.com/WV/115844/316316/reports/summary.zip", path: "data/source/rapid/state-general/wv/2022-general-clarity-summary.zip", cycleYear: 2022, electionDate: "2022-11-08", note: "100 House of Delegates (superseded by 2024) and 17 Senate contests for the other seat in each district." },
];

export const WEST_VIRGINIA_GENERAL: StateGeneralAdapter = {
  stateCode: "WV",
  authority: "West Virginia Secretary of State, general election results (Clarity ENR)",
  sources: SOURCES,
  expectedContests: { "wv-2024-general-clarity-summary-zip": 117, "wv-2022-general-clarity-summary-zip": 117 },
  parse: (bytes, source) => parseClaritySummary(bytes, (contest) => {
    const house = contest.match(/^HOUSE OF DELEGATES, (\d+(?:st|nd|rd|th)) District \(Vote For (\d+)\)$/);
    if (house) return { chamber: "lower", district: ordinal(house[1]!), seats: Number(house[2]) };
    const senate = contest.match(/^STATE SENATOR, (\d+(?:st|nd|rd|th)) Senatorial District \(Vote For (\d+)\)$/);
    // Each Senate cycle elects one of the district's two seats; the seat is recorded as a position named for the cycle.
    return senate ? { chamber: "upper", district: ordinal(senate[1]!), seats: Number(senate[2]), position: String(source.cycleYear) } : null;
  }),
};
