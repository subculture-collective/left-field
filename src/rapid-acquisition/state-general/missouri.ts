import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Missouri Secretary of State, official general election results (PDF,
 * statewide totals per candidate). The build reads each PDF's pinned
 * `pdftotext -layout` extract: a race line ("State Representative - District
 * 4   (49 of 49 Precincts Reported)"), one line per candidate with name,
 * party, votes and percent, and usually a "Total Votes" line, which is
 * checked against the candidate sum. Write-in candidates carry the party
 * label "Write-in". Uncontested races are listed.
 *
 * All 163 House districts are elected every two years; Senate terms are four
 * years, odd districts in 2024 and even districts in 2022.
 */
const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const SOURCES: readonly StateGeneralSource[] = [
  { id: "mo-2024-general-results-pdf", url: "https://www.sos.mo.gov/CMSImages/ElectionResultsStatistics/2024GeneralElection.pdf", path: "data/source/rapid/state-general/mo/2024-general-results.pdf", cycleYear: 2024, electionDate: "2024-11-05", note: "163 House and 17 odd-numbered Senate contests.", userAgent: BROWSER, pdfLayoutExtract: true },
  { id: "mo-2022-general-results-pdf", url: "https://www.sos.mo.gov/CMSImages/ElectionResultsStatistics/2022GeneralElection.pdf", path: "data/source/rapid/state-general/mo/2022-general-results.pdf", cycleYear: 2022, electionDate: "2022-11-08", note: "163 House (superseded by 2024) and 17 even-numbered Senate contests.", userAgent: BROWSER, pdfLayoutExtract: true },
];

const fail = (code: string): never => { throw new Error(`MISSOURI_GENERAL_${code}`); };
const integer = (value: string): number => { const digits = value.replace(/,/g, ""); return /^\d+$/.test(digits) ? Number(digits) : fail(`INTEGER_INVALID:${value}`); };

function parse(bytes: Buffer): RawGeneralContest[] {
  type Open = { chamber: "upper" | "lower"; district: string; candidates: { name: string; rawParty: string; votes: number; writeIn: boolean }[]; total: number | null };
  const contests: Open[] = [];
  let current: Open | null = null;
  for (const raw of bytes.toString("utf8").split(/\r?\n/)) {
    const line = raw.replace(/\f/g, "");
    const race = line.match(/^\s*State (Senator|Representative) - District (\d+)\s+\(/);
    if (race) { current = { chamber: race[1] === "Senator" ? "upper" : "lower", district: race[2]!, candidates: [], total: null }; contests.push(current); continue; }
    if (!current) continue;
    const total = line.match(/^\s+Total Votes\s+([\d,]+)\s*$/);
    if (total) { current.total = integer(total[1]!); current = null; continue; }
    const candidate = line.match(/^\s*(\S.*?)\s{2,}(\S.*?)\s{2,}([\d,]+)\s+[\d.]+%\s*$/);
    if (candidate) { current.candidates.push({ name: candidate[1]!.trim(), rawParty: candidate[2]!.trim() === "Write-in" ? "" : candidate[2]!.trim(), votes: integer(candidate[3]!), writeIn: candidate[2]!.trim() === "Write-in" }); continue; }
    // Any other non-blank line (a new office heading or page header) closes the race.
    if (line.trim() !== "" && current.candidates.length > 0) current = null;
  }
  for (const contest of contests) {
    if (contest.candidates.length === 0) fail(`NO_CANDIDATES:${contest.chamber}:${contest.district}`);
    if (contest.total !== null && contest.total !== contest.candidates.reduce((sum, candidate) => sum + candidate.votes, 0)) fail(`TOTAL_MISMATCH:${contest.chamber}:${contest.district}`);
  }
  return contests.map((contest) => ({ chamber: contest.chamber, district: contest.district, candidates: contest.candidates }));
}

export const MISSOURI_GENERAL: StateGeneralAdapter = {
  stateCode: "MO",
  authority: "Missouri Secretary of State, official general election results",
  sources: SOURCES,
  expectedContests: { "mo-2024-general-results-pdf": 180, "mo-2022-general-results-pdf": 180 },
  parse: (bytes) => parse(bytes),
};
