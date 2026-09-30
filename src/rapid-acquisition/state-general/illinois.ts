import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Illinois State Board of Elections, general-election vote totals export
 * (tab-delimited, Latin-1, one row per candidate statewide). Office names
 * read "50TH REPRESENTATIVE" and "31ST SENATE". All 118 House districts are
 * elected every two years; the Senate is staggered, so the 2022 file (all 59
 * Senate districts after redistricting) supplies the districts not on the
 * 2024 ballot. Rows with no party are write-in candidates.
 */
const SOURCES: readonly StateGeneralSource[] = [
  {
    id: "il-2024-general-vote-totals-txt",
    url: "https://elections.il.gov/NewDocDisplay.aspx?khDtbt6dhc8zLboSZnz8zqVh5SQVox7uAOAe2nieWDAlNyd4%2btjArHsz9xVXIJ4p6Y57u3FvWw0%2bgnNWdT3uKyV44EJPSNKJqSNPoTMrt%2fmA2Vga9kq1Ze1iXEwZay4hPK3eAEa%2f2we615l6oeLwg6WnqfsqBpfSiMD2IVAStFjXpRXB%2fbuc8Fffiv7E9yHUq3z9uD%2bG6NY%3d",
    path: "data/source/rapid/state-general/il/2024-general-totals.txt",
    cycleYear: 2024,
    electionDate: "2024-11-05",
    note: "118 House and 24 Senate contests.",
  },
  {
    id: "il-2022-general-vote-totals-txt",
    url: "https://elections.il.gov/NewDocDisplay.aspx?khDtbt6dhc8zLboSZnz8zqVh5SQVox7uAOAe2nieWDAlNyd4%2btjArHsz9xVXIJ4p6Y57u3FvWw0%2bgnNWdT3uKyV44EJPSNKJqSNPoTMrt%2fmA2Vga9kq1ZSMw8T%2bTP0Bu5MYScFngpt7DT1jIISrO8vbwEz2j1UaUFk4Ught6jyKPD0J6ZjQaef6%2fy5lLn0i%2brhqAS%2fOCDIRvrRtL96BN5g%3d%3d",
    path: "data/source/rapid/state-general/il/2022-general-totals.txt",
    cycleYear: 2022,
    electionDate: "2022-11-08",
    note: "118 House and all 59 Senate contests; House rows are superseded by 2024.",
  },
];

const fail = (code: string): never => { throw new Error(`ILLINOIS_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);
const unquote = (value: string): string => value.replace(/^"(.*)"$/, "$1").trim();

function parse(bytes: Buffer): RawGeneralContest[] {
  const lines = bytes.toString("latin1").split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = lines[0]!.split("\t").map(unquote);
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const officeCol = column("OfficeName"), firstCol = column("CanFirstName"), lastCol = column("CanLastName"), votesCol = column("Votes"), partyCol = column("PartyAbbrev"), seatsCol = column("VoteFor");
  const contests = new Map<string, RawGeneralContest & { candidates: { name: string; rawParty: string; votes: number; writeIn: boolean }[] }>();
  for (const line of lines.slice(1)) {
    const cells = line.split("\t").map(unquote);
    const office = cells[officeCol]!;
    const match = office.match(/^(\d+)(?:ST|ND|RD|TH) (SENATE|REPRESENTATIVE)$/);
    if (!match) continue;
    const chamber = match[2] === "SENATE" ? "upper" as const : "lower" as const;
    const entry = contests.get(office) ?? { chamber, district: match[1]!, seats: integer(cells[seatsCol]!), candidates: [] };
    const rawParty = cells[partyCol]!;
    entry.candidates.push({ name: `${cells[firstCol]} ${cells[lastCol]}`.replace(/\s+/g, " ").trim(), rawParty, votes: integer(cells[votesCol]!), writeIn: rawParty === "" });
    contests.set(office, entry);
  }
  return [...contests.values()];
}

export const ILLINOIS_GENERAL: StateGeneralAdapter = {
  stateCode: "IL",
  authority: "Illinois State Board of Elections, general election vote totals",
  sources: SOURCES,
  expectedContests: { "il-2024-general-vote-totals-txt": 142, "il-2022-general-vote-totals-txt": 177 },
  parse: (bytes) => parse(bytes),
};
