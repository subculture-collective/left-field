import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { assignWords, cells, count } from "./layout-columns";

/**
 * Oregon Secretary of State, official general election abstracts of votes
 * (PDF). The build reads each PDF's pinned `pdftotext -layout` extract.
 * Under a centred "State Senator" or "State Representative" heading, each
 * district block reads "5th District", a row of surnames ("**" marks the
 * winner) ending in "Misc." (write-ins), a row "County  Jo (D)  Dick (R)"
 * whose parenthesised codes give each candidate's party, one row per county,
 * and, for multi-county districts, a "Total" row. The Total row's cells are
 * offset from the county columns in the extract, so the county rows are
 * summed in column order and the sum is checked against the Total row.
 *
 * All 60 House districts are elected every two years; Senate terms are four
 * years, half the districts each cycle, so the 2022 abstract supplies the
 * other half. Uncontested candidates are listed.
 */
const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const SOURCES: readonly StateGeneralSource[] = [
  { id: "or-2024-general-abstract-pdf", url: "https://records.sos.state.or.us/ORSOSWebDrawer/Record/13735458/File/document", path: "data/source/rapid/state-general/or/2024-general-abstract.pdf", cycleYear: 2024, electionDate: "2024-11-05", note: "60 House and 15 Senate contests.", userAgent: BROWSER, pdfLayoutExtract: true },
  { id: "or-2022-general-abstract-pdf", url: "https://records.sos.state.or.us/ORSOSWebDrawer/Record/13735454/File/document", path: "data/source/rapid/state-general/or/2022-general-abstract.pdf", cycleYear: 2022, electionDate: "2022-11-08", note: "60 House (superseded by 2024) and 15 Senate contests.", userAgent: BROWSER, pdfLayoutExtract: true },
];

const fail = (code: string): never => { throw new Error(`OREGON_GENERAL_${code}`); };

function parse(bytes: Buffer): RawGeneralContest[] {
  const lines = bytes.toString("utf8").replace(/\f/g, "\n").split(/\r?\n/);
  const contests: RawGeneralContest[] = [];
  let chamber: "upper" | "lower" | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const heading = line.match(/^\s{20,}(\S.*?)\s*$/);
    if (heading) { chamber = heading[1] === "State Senator" ? "upper" : heading[1] === "State Representative" ? "lower" : /Abstract of Votes|^Page\b/.test(heading[1]!) ? chamber : null; continue; }
    const district = line.match(/^\s*(\d+)(?:st|nd|rd|th) District\s*$/);
    if (!district || chamber === null) continue;
    // Blank lines can separate the district heading from its header rows.
    let head = index + 1;
    while (head < lines.length && lines[head]!.trim() === "") head++;
    const partyLine = lines[head + 1] ?? "";
    if (!/^\s*County\b/.test(partyLine)) fail(`BLOCK_HEADER:${chamber}:${district[1]}`);
    const named = [...partyLine.replace(/^\s*County\s+/, "").matchAll(/(.+?)\s*\(([A-Z]+)\)/g)].map((match) => ({ given: match[1]!.trim(), party: match[2]! }));
    const width = named.length + 1;
    // Surnames can be printed one space apart in crowded rows, so each word goes to the nearest vote column of the
    // first county row; the last column is "Misc." (write-ins).
    const anchors = cells(lines[head + 2] ?? "").filter((cell) => count(cell.text) !== null).map((cell) => cell.centre);
    if (anchors.length !== width) fail(`ANCHORS:${chamber}:${district[1]}:${anchors.length}/${width}`);
    const surnames = assignWords(anchors, lines[head] ?? "").map((text) => text.replace(/\*\*/g, "").trim());
    if (surnames[width - 1] !== "Misc." || surnames.slice(0, -1).some((text) => text === "")) fail(`SURNAMES:${chamber}:${district[1]}:${surnames.join("|")}`);
    const sums = Array.from({ length: width }, () => 0);
    let total: number[] | null = null, counties = 0, cursor = head + 2;
    for (; cursor < lines.length; cursor++) {
      const row = lines[cursor]!;
      if (row.trim() === "") break;
      const values = cells(row).map((cell) => count(cell.text));
      const numbers = values.filter((value): value is number => value !== null);
      if (/^\s+Total\b/i.test(row)) { total = numbers; continue; }
      // A line with no counts (the "** Elected" page footer) ends the block like a blank line.
      if (numbers.length === 0) break;
      if (numbers.length !== width) fail(`ROW_WIDTH:${chamber}:${district[1]}:${row.trim()}`);
      numbers.forEach((value, column) => { sums[column] += value; });
      counties++;
    }
    if (counties === 0) fail(`NO_COUNTIES:${chamber}:${district[1]}`);
    if (total && (total.length !== width || total.some((value, column) => value !== sums[column]))) fail(`TOTAL_MISMATCH:${chamber}:${district[1]}`);
    contests.push({
      chamber, district: district[1]!,
      candidates: [...named.map((candidate, column) => ({ name: `${candidate.given} ${surnames[column]}`, rawParty: candidate.party, votes: sums[column]! })), { name: "Misc.", rawParty: "", votes: sums[width - 1]!, writeIn: true }],
    });
    index = cursor;
  }
  return contests;
}

export const OREGON_GENERAL: StateGeneralAdapter = {
  stateCode: "OR",
  authority: "Oregon Secretary of State, official general election abstracts of votes",
  sources: SOURCES,
  expectedContests: { "or-2024-general-abstract-pdf": 75, "or-2022-general-abstract-pdf": 75 },
  parse: (bytes) => parse(bytes),
};
