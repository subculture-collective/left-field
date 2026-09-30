import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";
import { assignWords, cells, count } from "./layout-columns";

/**
 * Kentucky State Board of Elections, 2024 general election certification as
 * amended on December 9, 2024 (PDF). The build reads its pinned `pdftotext
 * -layout` extract. Each race block reads "State Representative" (or "State
 * Senator"), "12th Representative District" (or "Senatorial District"), a row
 * of party headings ("Republican Party   Democratic Party"), each candidate's
 * name over two rows (given names, then surname), county rows, and a
 * "Total Votes" row with one total per candidate, in column order.
 *
 * All 100 House districts and the 19 odd-numbered Senate districts were on
 * the 2024 ballot, uncontested races included. The 2022 certification (even
 * Senate districts) is a scanned image without a text layer, so senators
 * elected in 2022 stay unscored.
 */
const SOURCES: readonly StateGeneralSource[] = [
  { id: "ky-2024-general-certification-pdf", url: "https://elect.ky.gov/results/2020-2029/Documents/2024%20General%20Election%20Certification%20as%20Amended%20on%20December%209th%202024.pdf", path: "data/source/rapid/state-general/ky/2024-general-certification.pdf", cycleYear: 2024, electionDate: "2024-11-05", note: "100 House and 19 odd-numbered Senate contests.", userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", pdfLayoutExtract: true },
];

const fail = (code: string): never => { throw new Error(`KENTUCKY_GENERAL_${code}`); };

function parse(bytes: Buffer): RawGeneralContest[] {
  const lines = bytes.toString("utf8").replace(/\f/g, "\n").split(/\r?\n/);
  const contests: RawGeneralContest[] = [];
  for (let index = 0; index < lines.length; index++) {
    const office = lines[index]!.trim();
    if (office !== "State Representative" && office !== "State Senator") continue;
    const districtLine = lines[index + 1]?.trim() ?? "";
    const district = districtLine.match(/^(\d+)(?:st|nd|rd|th) (Representative|Senatorial) District$/);
    if (!district) continue;
    // Party headings, then two name rows, then counts; blank lines separate them.
    let cursor = index + 2;
    const next = (): string => { while (cursor < lines.length && lines[cursor]!.trim() === "") cursor++; return lines[cursor++] ?? ""; };
    const partyRow = cells(next());
    // Headings are "Republican Party", "Democratic Party", "Independent", "Write-In" and the like; never counts.
    if (partyRow.length === 0 || partyRow.some((cell) => count(cell.text) !== null)) fail(`PARTY_ROW:${districtLine}`);
    const anchors = partyRow.map((cell) => cell.centre);
    const given = assignWords(anchors, next()), surname = assignWords(anchors, next());
    let totals: number[] | null = null;
    while (cursor < lines.length) {
      const line = lines[cursor++]!;
      if (/^\s*Total Votes\b/.test(line)) { totals = cells(line).slice(1).map((cell) => count(cell.text) ?? fail(`TOTAL_CELL:${districtLine}:${cell.text}`)); break; }
      if (/^\s*State (Representative|Senator)\s*$/.test(line)) break;
    }
    if (!totals) fail(`TOTALS_MISSING:${districtLine}`);
    // A race contested only by write-in candidates (the 2024 29th Senatorial District) has no party-labelled columns
    // and a layout pdftotext cannot align; it carries no Democratic or Republican candidate, so only the totals matter.
    if (partyRow.every((cell) => /^Write-?In/i.test(cell.text))) {
      contests.push({ chamber: district[2] === "Senatorial" ? "upper" : "lower", district: district[1]!, candidates: totals!.map((votes, column) => ({ name: `Write-in candidate ${column + 1}`, rawParty: "Write-In", votes })) });
      index = cursor - 1;
      continue;
    }
    if (totals!.length !== anchors.length) fail(`TOTALS:${districtLine}:${totals!.length}/${anchors.length}`);
    contests.push({
      chamber: district[2] === "Senatorial" ? "upper" : "lower", district: district[1]!,
      candidates: anchors.map((_anchor, column) => {
        const writeIn = /^Write-?In/i.test(partyRow[column]!.text);
        return { name: `${given[column]} ${surname[column]}`.replace(/\s+/g, " ").trim(), rawParty: writeIn ? "" : partyRow[column]!.text.replace(/ Party$/, ""), votes: totals![column]!, writeIn };
      }),
    });
    index = cursor - 1;
  }
  return contests;
}

export const KENTUCKY_GENERAL: StateGeneralAdapter = {
  stateCode: "KY",
  authority: "Kentucky State Board of Elections, 2024 general election certification",
  sources: SOURCES,
  expectedContests: { "ky-2024-general-certification-pdf": 119 },
  parse: (bytes) => parse(bytes),
};
