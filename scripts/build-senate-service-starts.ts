import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";

const ROSTER_PATH = "data/source/identity/senate-members.xml";
const CHRONOLOGY_PATH = "data/source/identity/senate-chronological-list.txt";
const OUTPUT_PATH = "data/source/identity/senate-service-starts.json";
const NAME_COLUMN_END = 72;
const bytewise = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));

export interface ServiceStartEntry {
  readonly state: string;
  readonly senateClass: 1 | 2 | 3;
  readonly displayName: string;
  readonly initialServiceDate: string;
  readonly evidence: { readonly line: number; readonly text: string };
}
export interface SenateServiceStartsArtifact {
  readonly schemaVersion: 1;
  readonly chronologySource: "data/source/identity/senate-chronological-list.txt";
  readonly chronologyDated: "2026-07-14";
  readonly entries: Readonly<Record<string, ServiceStartEntry>>;
}

interface RosterMember { readonly id: string; readonly state: string; readonly senateClass: 1 | 2 | 3; readonly displayName: string; readonly chronologyName: string; }
interface ChronologyRow { readonly date: string; readonly name: string; readonly state: string; readonly line: number; readonly text: string; }

/** Converts roster and chronology name spellings into a conservative comparison key. */
export function normalizeSenatorName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[“”'’.,]/g, "").replace(/\b(jr|sr|ii|iii|iv)\b/gi, "").replace(/[-\s]+/g, " ").trim().toLowerCase();
}

/** Reviewed only where the two official sources cannot match after normalization. */
export const CHRONOLOGY_NAME_EXCEPTIONS: Readonly<Record<string, string>> = {
  // Bioguide ID: normalized chronology surname-first name.
  A000382: "alsobrooks angela",
  B001299: "banks james e", B001267: "bennet michael", B001288: "booker cory", B001319: "britt katie",
  C001035: "collins susan", C001088: "coons christopher", C001056: "cornyn john", D000563: "durbin richard",
  G000555: "gillibrand kirsten", G000608: "graham darline", G000386: "grassley charles e",
  H000601: "hagerty william f bill", H001076: "hassan maggie", H001042: "hirono mazie", H001104: "husted jon a",
  J000312: "justice james", K000377: "kelly mark e", K000394: "kim andy", K000383: "king angus",
  L000570: "lujan ben ray", L000571: "lummis cynthia m", M001198: "marshall roger w", M001244: "moody ashley b",
  M001153: "murkowski lisa", M001169: "murphy chris", M001111: "murray patty", O000174: "ossoff jon",
  P000595: "peters gary", R000618: "ricketts john peter pete", R000584: "risch jim", S000033: "sanders bernie",
  S001194: "schatz brian e", S001150: "schiff adam b", S000148: "schumer charles", T000278: "tuberville thomas h tommy",
  W000805: "warner mark", W000790: "warnock raphael g", W000437: "wicker roger f",
};

function isoDate(month: string, day: string, year: string): string {
  const months: Record<string, string> = { January: "01", February: "02", March: "03", April: "04", May: "05", June: "06", July: "07", August: "08", September: "09", October: "10", November: "11", December: "12" };
  const result = `${year}-${months[month]}-${day.padStart(2, "0")}`;
  if (!months[month] || Number.isNaN(Date.parse(`${result}T00:00:00Z`))) throw new Error(`Invalid chronology date: ${month} ${day}, ${year}`);
  return result;
}

function parseRoster(xml: string): RosterMember[] {
  const parsed = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml) as { contact_information: { member: Array<Record<string, string>> } };
  return parsed.contact_information.member.map(member => {
    const senateClass = ({ "Class I": 1, "Class II": 2, "Class III": 3 } as const)[member.class];
    if (!senateClass || !/^[A-Z]\d{6}$/.test(member.bioguide_id) || !/^[A-Z]{2}$/.test(member.state)) throw new Error("Malformed current Senate roster row.");
    return { id: member.bioguide_id, state: member.state, senateClass, displayName: `${member.first_name} ${member.last_name}`, chronologyName: normalizeSenatorName(`${member.last_name}, ${member.first_name}`) };
  });
}

/** Parses the date at the left edge and the fixed end-service boundary at column 72. */
export function parseChronology(text: string): ChronologyRow[] {
  let year = ""; let forwardedDate = ""; const rows: ChronologyRow[] = [];
  for (const [index, textLine] of text.split(/\r?\n/).entries()) {
    const line = index + 1;
    const yearMatch = /^\s*\* \* \*\s*(\d{4})\s*\* \* \*/.exec(textLine);
    if (yearMatch) { year = yearMatch[1]; forwardedDate = ""; continue; }
    const dateMatch = /^\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b\s*(.*)$/.exec(textLine);
    if (dateMatch) forwardedDate = isoDate(dateMatch[1], dateMatch[2], year);
    // The separate end-of-service column is deliberately excluded from this name cell.
    const nameCell = (dateMatch ? dateMatch[3].slice(0, NAME_COLUMN_END - (textLine.length - dateMatch[3].length)) : textLine.slice(0, NAME_COLUMN_END)).trim();
    const nameMatch = /^(.+?)\s*(?:\d+)?\s*\(([A-Za-z/\-]+)-([A-Z]{2})\)(?:\s*\d+)?\s*$/.exec(nameCell);
    if (nameMatch && forwardedDate) rows.push({ date: forwardedDate, name: normalizeSenatorName(nameMatch[1]), state: nameMatch[3], line, text: textLine });
  }
  return rows;
}

export function buildArtifact(rosterXml: string, chronologyText: string): SenateServiceStartsArtifact {
  const roster = parseRoster(rosterXml);
  if (roster.length !== 100 || new Set(roster.map(member => member.id)).size !== 100) throw new Error("Current Senate roster must contain exactly 100 unique Bioguide IDs.");
  const chronology = parseChronology(chronologyText);
  const entries: Record<string, ServiceStartEntry> = {};
  const unmatched: string[] = [];
  for (const member of roster) {
    const expected = CHRONOLOGY_NAME_EXCEPTIONS[member.id] ?? member.chronologyName;
    const matches = chronology.filter(row => row.state === member.state && row.name === expected);
    if (matches.length !== 1) { unmatched.push(`${member.id} (${member.displayName}): ${matches.length}`); continue; }
    const match = matches[0];
    entries[member.id] = { state: member.state, senateClass: member.senateClass, displayName: member.displayName, initialServiceDate: match.date, evidence: { line: match.line, text: match.text } };
  }
  if (unmatched.length) throw new Error(`Expected exactly one chronology row for each roster member: ${unmatched.join("; ")}`);
  return { schemaVersion: 1, chronologySource: "data/source/identity/senate-chronological-list.txt", chronologyDated: "2026-07-14", entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => bytewise(a, b))) };
}

export async function main(): Promise<void> {
  const [roster, chronology] = await Promise.all([readFile(resolve(ROSTER_PATH), "utf8"), readFile(resolve(CHRONOLOGY_PATH), "utf8")]);
  await writeFile(resolve(OUTPUT_PATH), `${JSON.stringify(buildArtifact(roster, chronology), null, 2)}\n`);
}

if (process.argv[1]?.endsWith("build-senate-service-starts.ts")) {
  void main().catch(error => { throw error; });
}
