import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Rhode Island Board of Elections results JSON, one file per office
 * (ri.gov, 2024 general election, last updated 2024-11-22). Contests read
 * "Senator in General Assembly District 1" and "Representative in General
 * Assembly District 1"; candidate names carry a party prefix ("DEM Jacob
 * Bissaillon") that duplicates party_code and is removed. Every contest has
 * a "Write-in" row. Both chambers serve two-year terms.
 */
const SOURCES: readonly (StateGeneralSource & { chamber: "upper" | "lower" })[] = [
  { id: "ri-2024-general-senator-json", url: "https://rigov.s3.amazonaws.com/election/results/2024/general_election/ga_senator.json", path: "data/source/rapid/state-general/ri/2024-general-senator.json", cycleYear: 2024, electionDate: "2024-11-05", note: "38 Senate contests.", chamber: "upper" },
  { id: "ri-2024-general-representative-json", url: "https://rigov.s3.amazonaws.com/election/results/2024/general_election/ga_representative.json", path: "data/source/rapid/state-general/ri/2024-general-representative.json", cycleYear: 2024, electionDate: "2024-11-05", note: "75 House contests.", chamber: "lower" },
];

type Document = { contests: { name: string; candidates: { name: string; party_code: string; votes: string | number }[] }[] };
const fail = (code: string): never => { throw new Error(`RHODE_ISLAND_GENERAL_${code}`); };
const integer = (value: string | number): number => /^\d+$/.test(String(value).trim()) ? Number(String(value).trim()) : fail(`INTEGER_INVALID:${value}`);

function parse(bytes: Buffer, source: StateGeneralSource): RawGeneralContest[] {
  const spec = SOURCES.find((candidate) => candidate.id === source.id) ?? fail(`SOURCE_UNKNOWN:${source.id}`);
  const document = JSON.parse(bytes.toString("utf8")) as Document;
  return document.contests.map((contest) => {
    const match = contest.name.match(/^(Senator|Representative) in General Assembly District (\d+)$/);
    if (!match || (match[1] === "Senator") !== (spec.chamber === "upper")) fail(`CONTEST_UNRECOGNIZED:${contest.name}`);
    return {
      chamber: spec.chamber, district: match![2]!,
      candidates: contest.candidates.map((candidate) => {
        const writeIn = /^write-?in$/i.test(candidate.name.trim());
        const party = candidate.party_code.trim();
        const name = candidate.name.trim().replace(new RegExp(`^${party}\\s+`), "");
        return { name, rawParty: writeIn || party === "NON" ? "" : party, votes: integer(candidate.votes), writeIn };
      }),
    };
  });
}

export const RHODE_ISLAND_GENERAL: StateGeneralAdapter = {
  stateCode: "RI",
  authority: "Rhode Island Board of Elections, 2024 general election results",
  sources: SOURCES.map(({ id, url, path, cycleYear, electionDate, note }) => ({ id, url, path, cycleYear, electionDate, note })),
  expectedContests: { "ri-2024-general-senator-json": 38, "ri-2024-general-representative-json": 75 },
  parse,
};
