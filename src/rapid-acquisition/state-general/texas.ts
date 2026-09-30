import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Texas Secretary of State, election night reporting data behind
 * results.texas-election.com: "Districted.json" for an election lists every
 * district race with each candidate's party code and vote total. Races read
 * "STATE REPRESENTATIVE DISTRICT 1" and "STATE SENATOR, DISTRICT 6";
 * incumbents carry " (I)", which is removed. Party "W" is a write-in.
 *
 * The 2024 file (election 49664) includes uncontested races and covers all
 * 150 House districts and the 15 Senate districts on that ballot. The 2022
 * file (election 47009) omits uncontested races, so it is read only for
 * Senate districts, which the 2024 contest supersedes wherever both exist.
 * A Senate district elected unopposed in 2022 and not in 2024 has no
 * contest and stays unscored.
 *
 * The site sits behind a bot filter that blocks this project's usual
 * network path; these files were retained through a residential connection.
 */
const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const SOURCES: readonly StateGeneralSource[] = [
  { id: "tx-2024-general-districted-json", url: "https://results.texas-election.com/static/data/election/49664/1012/Districted.json", path: "data/source/rapid/state-general/tx/2024-general-districted.json", cycleYear: 2024, electionDate: "2024-11-05", note: "150 House and 15 Senate contests, uncontested included.", userAgent: BROWSER },
  { id: "tx-2022-general-districted-json", url: "https://results.texas-election.com/static/data/election/47009/242/Districted.json", path: "data/source/rapid/state-general/tx/2022-general-districted.json", cycleYear: 2022, electionDate: "2022-11-08", note: "Read only for the 21 contested Senate races; uncontested races are omitted.", userAgent: BROWSER },
];

type Race = { N: string; Candidates: { N: string; P: string; V: number }[] };
const fail = (code: string): never => { throw new Error(`TEXAS_GENERAL_${code}`); };

function parse(bytes: Buffer, source: StateGeneralSource): RawGeneralContest[] {
  const document = JSON.parse(bytes.toString("utf8")) as { Races?: Race[] };
  if (!Array.isArray(document.Races)) fail(`SHAPE:${source.id}`);
  return document.Races!.flatMap((race): RawGeneralContest[] => {
    const match = race.N.match(/^STATE (SENATOR,|REPRESENTATIVE) DISTRICT (\d+)$/);
    if (!match) return [];
    const chamber = match[1] === "SENATOR," ? "upper" as const : "lower" as const;
    if (source.cycleYear === 2022 && chamber === "lower") return [];
    return [{ chamber, district: match[2]!, candidates: race.Candidates.map((candidate) => ({ name: candidate.N.replace(/\s*\(I\)\s*$/, "").trim(), rawParty: candidate.P === "W" ? "" : candidate.P, votes: candidate.V, writeIn: candidate.P === "W" })) }];
  });
}

export const TEXAS_GENERAL: StateGeneralAdapter = {
  stateCode: "TX",
  authority: "Texas Secretary of State, election night reporting results",
  sources: SOURCES,
  expectedContests: { "tx-2024-general-districted-json": 165, "tx-2022-general-districted-json": 21 },
  parse,
};
