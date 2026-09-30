import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * New Jersey Division of Elections, official general election candidate
 * lists with tallies (PDF). The build reads each PDF's pinned `pdftotext
 * -layout` extract. Each district opens with "Fifth Legislative District:
 * ... Counties"; each candidate line starts at the margin with the name
 * (marked "(w)" for winners and "*" for incumbents), the address, and the
 * party or slogan at the end of the line; county rows follow and a "Total"
 * line closes the candidate. A second "Total" closes the district and is
 * checked against the candidate totals. Page headers repeat the district
 * heading when a district continues onto a new page.
 *
 * The General Assembly was last elected in November 2025, two members per
 * district, so each Assembly contest fills two seats. The Senate was last
 * elected in 2023. There are no write-in lines.
 */
const SOURCES: readonly (StateGeneralSource & { chamber: "upper" | "lower"; seats: number })[] = [
  { id: "nj-2025-general-assembly-pdf", url: "https://www.nj.gov/state/elections/assets/pdf/election-results/2025/2025-official-general-results-general-assembly.pdf", path: "data/source/rapid/state-general/nj/2025-general-assembly.pdf", cycleYear: 2025, electionDate: "2025-11-04", note: "40 Assembly districts, two seats each.", pdfLayoutExtract: true, chamber: "lower", seats: 2 },
  { id: "nj-2023-general-state-senate-pdf", url: "https://www.nj.gov/state/elections/assets/pdf/election-results/2023/2023-official-general-results-state-senate.pdf", path: "data/source/rapid/state-general/nj/2023-general-state-senate.pdf", cycleYear: 2023, electionDate: "2023-11-07", note: "40 Senate districts.", pdfLayoutExtract: true, chamber: "upper", seats: 1 },
];

const UNITS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
const TEENS: Readonly<Record<string, number>> = { tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30, fortieth: 40 };
const TENS: Readonly<Record<string, number>> = { twenty: 20, thirty: 30 };
const fail = (code: string): never => { throw new Error(`NEW_JERSEY_GENERAL_${code}`); };
const integer = (value: string): number => { const digits = value.replace(/,/g, ""); return /^\d+$/.test(digits) ? Number(digits) : fail(`INTEGER_INVALID:${value}`); };

/** "Thirty-Fifth" becomes 35. */
export function ordinalWord(value: string): number {
  const key = value.toLowerCase();
  if (TEENS[key] !== undefined) return TEENS[key]!;
  const unit = UNITS.indexOf(key);
  if (unit > 0) return unit;
  const [tens, units] = key.split("-");
  const total = (TENS[tens ?? ""] ?? 0) + UNITS.indexOf(units ?? "");
  return TENS[tens ?? ""] !== undefined && UNITS.indexOf(units ?? "") > 0 ? total : fail(`ORDINAL:${value}`);
}

function parse(bytes: Buffer, source: StateGeneralSource): RawGeneralContest[] {
  const spec = SOURCES.find((candidate) => candidate.id === source.id) ?? fail(`SOURCE_UNKNOWN:${source.id}`);
  const contests = new Map<number, { name: string; rawParty: string; votes: number | null }[]>();
  let district: number | null = null;
  let open: { name: string; rawParty: string; votes: number | null } | null = null;
  for (const raw of bytes.toString("utf8").split(/\r?\n/)) {
    const line = raw.replace(/\f/g, "");
    const heading = line.match(/^([A-Za-z]+(?:-[A-Za-z]+)?) Legislative District:/);
    if (heading) { district = ordinalWord(heading[1]!); if (!contests.has(district)) contests.set(district, []); continue; }
    if (district === null || /^(Name\s+Address|\d{2}\/\d{2}\/\d{4}|\s*Candidates for|\s*For GENERAL)/.test(line)) continue;
    const total = line.match(/^\s+Total\s+([\d,]+)\s*$/);
    if (total) {
      // A Total with no open candidate is the district total that closes the block; it must equal the candidate totals.
      if (!open) { const sum = contests.get(district)!.reduce((acc, candidate) => acc + (candidate.votes ?? 0), 0); if (sum !== integer(total[1]!)) fail(`DISTRICT_TOTAL_MISMATCH:${district}`); continue; }
      open.votes = integer(total[1]!); open = null; continue;
    }
    // A candidate line starts at the margin and ends with a party word. Lines that start at the margin but end in digits
    // are an address or ZIP beside a wrapped name ("JACKSON (w) *  TRENTON, NJ 08602") or a row of the party summary at
    // the end of the file; a wrapped name ending in "-" is joined to the open candidate. Bracket continuations
    // ("MCCLELLAN)") close a parenthesis opened on the line above.
    const segments = line.trim().split(/\s{2,}/);
    if (!/^[A-Z][^\s(]/.test(line)) continue;
    const continuation = /\)$/.test(segments[0]!) && !segments[0]!.includes("(");
    const tail = segments[segments.length - 1]!;
    if (open && open.name.endsWith("-") && open.votes === null) { open.name = `${open.name}${segments[0]!.replace(/\s*\(w\).*$/, "").replace(/\s+\*.*$/, "").trim()}`; continue; }
    if (continuation || segments.length < 2 || !/[A-Za-z]$/.test(tail)) continue;
    const repeatName = segments[0]!.replace(/\s*\(w\).*$/, "").replace(/\s+\*.*$/, "").replace(/\s+\d.*$/, "").replace(/\s+P\.?O\.? BOX.*$/i, "").trim();
    // A candidate whose county rows run past a page break is repeated after the page header.
    if (open && open.votes === null && repeatName === open.name) continue;
    if (open) fail(`CANDIDATE_WITHOUT_TOTAL:${district}:${open.name}`);
    const rawParty = /\d/.test(tail) ? tail.match(/(Democratic|Republican|Libertarian Party|Green Party|[A-Za-z]+)$/)![1]! : tail;
    const name = segments[0]!.replace(/\s*\(w\).*$/, "").replace(/\s+\*.*$/, "").replace(/\s+\d.*$/, "").replace(/\s+P\.?O\.? BOX.*$/i, "").trim();
    open = { name, rawParty: rawParty.trim(), votes: null };
    contests.get(district)!.push(open);
  }
  if (open) fail(`CANDIDATE_WITHOUT_TOTAL:${district}:${open.name}`);
  return [...contests.entries()].map(([number, candidates]) => {
    if (candidates.length === 0 || candidates.some((candidate) => candidate.votes === null)) fail(`CONTEST_INCOMPLETE:${number}`);
    return { chamber: spec.chamber, district: String(number), seats: spec.seats, candidates: candidates.map((candidate) => ({ name: candidate.name, rawParty: candidate.rawParty, votes: candidate.votes! })) };
  });
}

export const NEW_JERSEY_GENERAL: StateGeneralAdapter = {
  stateCode: "NJ",
  authority: "New Jersey Division of Elections, official general election results",
  sources: SOURCES.map(({ id, url, path, cycleYear, electionDate, note, pdfLayoutExtract }) => ({ id, url, path, cycleYear, electionDate, note, pdfLayoutExtract })),
  expectedContests: { "nj-2025-general-assembly-pdf": 40, "nj-2023-general-state-senate-pdf": 40 },
  parse,
};
