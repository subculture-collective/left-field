import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Kansas Secretary of State, 2024 general election official vote totals
 * (PDF). The build reads its pinned `pdftotext -layout` extract: a race line
 * ("Kansas Senate 5", "Kansas House of Representatives 12") followed by one
 * indented line per candidate, "R-Jeff Klemp   15,732   50.05%", where the
 * prefix is the party (R, D, L, and UK for unaffiliated). Page headers repeat
 * between races and are skipped. All 125 House and all 40 Senate seats were
 * on the 2024 ballot, uncontested races included; there are no write-in
 * lines. The precinct workbooks were not used because the three largest
 * counties are on separate sheets in three different layouts, two without
 * party labels.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "ks-2024-general-official-vote-totals-pdf", url: "https://www.sos.ks.gov/elections/24elec/2024-General-Election-Official-Vote-Totals.pdf", path: "data/source/rapid/state-general/ks/2024-general-official-vote-totals.pdf", cycleYear: 2024, electionDate: "2024-11-05", note: "125 House and 40 Senate contests.", userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", pdfLayoutExtract: true },
];

const fail = (code: string): never => { throw new Error(`KANSAS_GENERAL_${code}`); };
const integer = (value: string): number => { const digits = value.replace(/,/g, ""); return /^\d+$/.test(digits) ? Number(digits) : fail(`INTEGER_INVALID:${value}`); };

function parse(bytes: Buffer): RawGeneralContest[] {
  const contests: RawGeneralContest[] = [];
  let current: { chamber: "upper" | "lower"; district: string; candidates: { name: string; rawParty: string; votes: number }[] } | null = null;
  for (const line of bytes.toString("utf8").split(/\r?\n/)) {
    const race = line.match(/^(\S.*?)\s*$/)?.[1];
    if (race && !/^\s/.test(line)) {
      const match = race.match(/^Kansas (Senate|House of Representatives) (\d+)$/);
      if (match) { current = { chamber: match[1] === "Senate" ? "upper" : "lower", district: match[2]!, candidates: [] }; contests.push(current); continue; }
      // Page headers ("Kansas Secretary of State", "Race  Candidate ...") are indented or not races; any other race ends the block.
      if (!/^(Race\b|Kansas Secretary of State)/.test(race)) current = null;
      continue;
    }
    const candidate = line.match(/^\s+([A-Z]{1,3})-(.+?)\s{2,}([\d,]+)\s+[\d.]+%\s*$/);
    if (current && candidate) current.candidates.push({ name: candidate[2]!.trim(), rawParty: candidate[1]!, votes: integer(candidate[3]!) });
  }
  for (const contest of contests) if (contest.candidates.length === 0) fail(`NO_CANDIDATES:${contest.chamber}:${contest.district}`);
  return contests;
}

export const KANSAS_GENERAL: StateGeneralAdapter = {
  stateCode: "KS",
  authority: "Kansas Secretary of State, 2024 general election official vote totals",
  sources: SOURCES,
  expectedContests: { "ks-2024-general-official-vote-totals-pdf": 165 },
  parse: (bytes) => parse(bytes),
};
