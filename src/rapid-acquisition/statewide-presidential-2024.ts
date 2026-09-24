import { readPinnedPackage, readRetainedSource, readSourceLock, type SourceLock } from "./intake/source-lock";
import { exact, hash } from "./shared";
import { US_STATE_CODES } from "./us-states";

/**
 * Statewide 2024 presidential vote from the House Clerk's official statistics
 * text. Each jurisdiction block opens with its name in capitals, then a
 * "FOR PRESIDENTIAL ELECTORS" heading, then one line per party label with a
 * dotted leader and a vote count. The block ends at the next "FOR ..." heading.
 */
export interface StatewidePresidentialRow {
  readonly stateCode: string;
  readonly stateName: string;
  readonly republicanVotes: number;
  readonly democraticVotes: number;
  readonly otherVotes: number;
  readonly totalVotes: number;
  readonly democraticMarginPercentagePoints: number;
  readonly rowSha256: string;
}

export interface StatewidePresidential2024 {
  readonly schema: "statewide-presidential-2024-v1";
  readonly version: 1;
  readonly sourceIds: readonly string[];
  readonly methodology: Readonly<{ marginDefinition: "democratic_minus_republican_share_of_all_listed_presidential_elector_votes"; partyLabels: "Republican_and_Democratic_lines_only_others_summed" }>;
  readonly rows: readonly StatewidePresidentialRow[];
  readonly summary: Readonly<{ jurisdictions: 51; states: 50; democraticWins: number; republicanWins: number; totalVotes: number }>;
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

export const STATEWIDE_PRESIDENTIAL_2024 = {
  id: "statewide-presidential-2024-v1",
  path: "data/metadata/statewide-presidential-2024-v1.json",
  url: "urn:dsa-seats:statewide-presidential-2024:v1",
  parentIds: ["clerk-text"],
} as const;

const two = (value: number) => Math.round(value * 100) / 100;
/** Page numbers, footnote markers, and "STATE—Continued" running heads carry no data. */
const isLayoutLine = (line: string): boolean => line === "" || /^\(?\d+\)?$/.test(line) || /—Continued$/.test(line);
const fail = (code: string): never => { throw new Error(`STATEWIDE_PRESIDENTIAL_${code}`); };

export function parseClerkPresidentialElectors(text: string): Omit<StatewidePresidentialRow, "rowSha256">[] {
  const lines = text.split("\n");
  const rows: Omit<StatewidePresidentialRow, "rowSha256">[] = [];
  const seen = new Set<string>();
  let stateName: string | null = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!.trim();
    if (line === "FOR PRESIDENTIAL ELECTORS") {
      // The jurisdiction name is the nearest preceding non-blank line in capitals.
      let cursor = index - 1;
      while (cursor >= 0 && isLayoutLine(lines[cursor]!.trim())) cursor--;
      const heading = lines[cursor]?.trim() ?? "";
      const name = Object.keys(US_STATE_CODES).find((candidate) => candidate.toUpperCase() === heading);
      if (!name) fail(`JURISDICTION_HEADING_INVALID:${heading}`);
      stateName = name!;
      if (seen.has(stateName)) fail(`JURISDICTION_DUPLICATE:${stateName}`);
      seen.add(stateName);
      let republican: number | null = null, democratic: number | null = null, other = 0;
      for (let body = index + 1; body < lines.length; body++) {
        const entry = lines[body]!.trim();
        if (/^FOR /.test(entry) || /^[A-Z][A-Z ]+$/.test(entry)) break;
        if (isLayoutLine(entry)) continue;
        const match = entry.match(/^(.*?)\s*\.{2,}\s*([\d,]+)$/);
        if (!match) fail(`ELECTOR_LINE_INVALID:${stateName}:${entry}`);
        const label = match![1]!.trim(), votes = Number(match![2]!.replace(/,/g, ""));
        if (!Number.isSafeInteger(votes)) fail(`VOTES_INVALID:${stateName}`);
        if (label === "Republican") republican = (republican ?? 0) + votes;
        else if (label === "Democratic") democratic = (democratic ?? 0) + votes;
        else other += votes;
      }
      if (republican === null || democratic === null) fail(`MAJOR_PARTY_MISSING:${stateName}`);
      const total = republican! + democratic! + other;
      rows.push({ stateCode: US_STATE_CODES[stateName]!, stateName, republicanVotes: republican!, democraticVotes: democratic!, otherVotes: other, totalVotes: total, democraticMarginPercentagePoints: two(((democratic! - republican!) / total) * 100) });
    }
  }
  return rows.sort((left, right) => left.stateCode.localeCompare(right.stateCode));
}

export function buildStatewidePresidential2024(root = process.cwd(), lock: SourceLock = readSourceLock(root)): StatewidePresidential2024 {
  const { bytes } = readRetainedSource(lock, "clerk-text", root);
  const rows = parseClerkPresidentialElectors(bytes.toString("utf8")).map((row) => ({ ...row, rowSha256: hash("dsa-seats:statewide-presidential-2024-row:v1", row) }));
  if (rows.length !== 51) fail(`JURISDICTION_COUNT:${rows.length}`);
  const summary = {
    jurisdictions: 51 as const,
    states: 50 as const,
    democraticWins: rows.filter((row) => row.democraticVotes > row.republicanVotes).length,
    republicanWins: rows.filter((row) => row.republicanVotes > row.democraticVotes).length,
    totalVotes: rows.reduce((sum, row) => sum + row.totalVotes, 0),
  };
  const unsigned = {
    schema: "statewide-presidential-2024-v1" as const,
    version: 1 as const,
    sourceIds: [...STATEWIDE_PRESIDENTIAL_2024.parentIds],
    methodology: { marginDefinition: "democratic_minus_republican_share_of_all_listed_presidential_elector_votes" as const, partyLabels: "Republican_and_Democratic_lines_only_others_summed" as const },
    rows,
    summary,
    rowSetSha256: hash("dsa-seats:statewide-presidential-2024-row-set:v1", rows),
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:statewide-presidential-2024-package:v1", unsigned) };
}

export function validateStatewidePresidential2024(value: unknown, root = process.cwd()): StatewidePresidential2024 {
  const expected = buildStatewidePresidential2024(root);
  if ((value as StatewidePresidential2024)?.packageSha256 !== expected.packageSha256 || !exact(value, expected)) fail("INVALID");
  return value as StatewidePresidential2024;
}

/** Lock-and-digest read of the retained package, without rebuilding. */
export function readStatewidePresidential2024Pinned(root = process.cwd(), lock: SourceLock = readSourceLock(root)): StatewidePresidential2024 {
  const { value } = readPinnedPackage<StatewidePresidential2024>(lock, STATEWIDE_PRESIDENTIAL_2024.id, "dsa-seats:statewide-presidential-2024-package:v1", root);
  if (value.schema !== "statewide-presidential-2024-v1" || value.rows.length !== 51) fail("PINNED_INVALID");
  return value;
}
