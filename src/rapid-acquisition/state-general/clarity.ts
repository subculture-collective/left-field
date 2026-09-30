import { unzipSync } from "fflate";

import type { RawGeneralContest } from "../state-legislative-general-results";
import { parseCsv } from "../state-legislative-roster";

/**
 * Shared reader for Clarity ENR "summary.zip" exports: one CSV row per
 * candidate with the contest's statewide total. States differ only in how
 * the contest name spells the chamber and district, so each adapter passes a
 * matcher that returns the chamber, district and seat count, or null for a
 * contest outside the legislature. Rows whose choice is a write-in line are
 * flagged as write-ins. Files are Latin-1.
 */
export type ClarityContestMatch = Readonly<{ chamber: "upper" | "lower"; district: string; seats?: number; position?: string }>;

const fail = (code: string): never => { throw new Error(`CLARITY_SUMMARY_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);

export function parseClaritySummary(bytes: Buffer, match: (contest: string) => ClarityContestMatch | null, options: Readonly<{ stripPartyPrefix?: boolean }> = {}): RawGeneralContest[] {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(new Uint8Array(bytes)); } catch { return fail("ZIP_INVALID"); }
  const csv = files["summary.csv"] ?? fail("SUMMARY_MISSING");
  const table = parseCsv(Buffer.from(csv).toString("latin1"));
  const header = table[0]!.map((cell) => cell.trim().toLowerCase());
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const contestCol = column("contest name"), nameCol = column("choice name"), partyCol = column("party name"), votesCol = column("total votes");
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; seats?: number; position?: string; candidates: { name: string; rawParty: string; votes: number; writeIn: boolean }[] }>();
  for (const row of table.slice(1)) {
    const contest = row[contestCol]!.replace(/\s+/g, " ").trim();
    const found = match(contest);
    if (!found) continue;
    const entry = contests.get(contest) ?? { ...found, candidates: [] };
    const rawParty = row[partyCol]!.trim();
    let name = row[nameCol]!.replace(/\s+/g, " ").trim();
    if (options.stripPartyPrefix && rawParty !== "" && name.startsWith(`${rawParty} `)) name = name.slice(rawParty.length + 1);
    const writeIn = /^write-?ins?$/i.test(name);
    entry.candidates.push({ name, rawParty: writeIn ? "" : rawParty, votes: integer(row[votesCol]!.trim()), writeIn });
    contests.set(contest, entry);
  }
  return [...contests.values()];
}

/** "1st", "22nd" and similar ordinals to their number as a string. */
export const ordinal = (value: string): string => String(Number(value.replace(/(st|nd|rd|th)$/i, "")));
