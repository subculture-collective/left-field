import type { RawGeneralContest, StateGeneralAdapter, StateGeneralSource } from "../state-legislative-general-results";

/**
 * Florida Division of Elections, official results extract (tab-delimited,
 * Latin-1, one row per candidate per county). RaceCode STR is the House and
 * STS the Senate; Juris1num holds the district. Multi-county districts are
 * summed. Write-in candidates carry party WRI.
 *
 * Florida does not put unopposed races on the ballot, so the extract has no
 * row for them. A district absent from the file stays unscored rather than
 * being given an inferred margin. For the same reason an older contest must
 * never stand in for a newer uncontested one: the 2022 file is read only
 * for the even-numbered Senate districts, which were elected in 2022 and not
 * in 2024. The extract is fetched by a form POST; the retained bytes are the
 * response to the body recorded below.
 */
const SOURCES: readonly (StateGeneralSource & { postBody: string; include: (office: string, district: number) => boolean })[] = [
  {
    id: "fl-2024-general-results-extract-txt",
    url: "https://results.elections.myflorida.com/ResultsExtract.Asp",
    postBody: "ElectionDate=11/5/2024&OfficialResults=Y&PartyRaces=N&DataMode=&FormsButton2=Download",
    path: "data/source/rapid/state-general/fl/2024-general-results-extract.txt",
    cycleYear: 2024,
    electionDate: "2024-11-05",
    note: "105 contested House and 18 contested odd-numbered Senate districts; unopposed races are not on the ballot.",
    include: (office) => office === "STR" || office === "STS",
  },
  {
    id: "fl-2022-general-results-extract-txt",
    url: "https://results.elections.myflorida.com/ResultsExtract.Asp",
    postBody: "ElectionDate=11/8/2022&OfficialResults=Y&PartyRaces=N&DataMode=&FormsButton2=Download",
    path: "data/source/rapid/state-general/fl/2022-general-results-extract.txt",
    cycleYear: 2022,
    electionDate: "2022-11-08",
    note: "Read only for contested even-numbered Senate districts.",
    include: (office, district) => office === "STS" && district % 2 === 0,
  },
];

const fail = (code: string): never => { throw new Error(`FLORIDA_GENERAL_${code}`); };
const integer = (value: string): number => /^\d+$/.test(value) ? Number(value) : fail(`INTEGER_INVALID:${value}`);

function parse(bytes: Buffer, source: StateGeneralSource): RawGeneralContest[] {
  const spec = SOURCES.find((candidate) => candidate.id === source.id) ?? fail(`SOURCE_UNKNOWN:${source.id}`);
  const lines = bytes.toString("latin1").split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = lines[0]!.split("\t").map((cell) => cell.trim());
  const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`COLUMN_MISSING:${name}`); };
  const raceCol = column("RaceCode"), districtCol = column("Juris1num"), partyCol = column("PartyCode"), lastCol = column("CanNameLast"), firstCol = column("CanNameFirst"), middleCol = column("CanNameMiddle"), votesCol = column("CanVotes");
  const contests = new Map<string, { chamber: "upper" | "lower"; district: string; candidates: Map<string, { name: string; rawParty: string; votes: number; writeIn: boolean }> }>();
  for (const line of lines.slice(1)) {
    const cells = line.split("\t");
    const office = cells[raceCol]!.trim();
    if (office !== "STR" && office !== "STS") continue;
    const district = integer(cells[districtCol]!.trim());
    if (!spec.include(office, district)) continue;
    const key = `${office}|${district}`;
    const entry = contests.get(key) ?? { chamber: office === "STS" ? "upper" as const : "lower" as const, district: String(district), candidates: new Map() };
    const party = cells[partyCol]!.trim();
    const name = [cells[firstCol], cells[middleCol], cells[lastCol]].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
    const candidate = entry.candidates.get(`${name}|${party}`) ?? { name, rawParty: party, votes: 0, writeIn: party === "WRI" };
    candidate.votes += integer(cells[votesCol]!.trim());
    entry.candidates.set(`${name}|${party}`, candidate);
    contests.set(key, entry);
  }
  return [...contests.values()].map((entry) => ({ chamber: entry.chamber, district: entry.district, candidates: [...entry.candidates.values()] }));
}

export const FLORIDA_GENERAL: StateGeneralAdapter = {
  stateCode: "FL",
  authority: "Florida Division of Elections, official results extract",
  sources: SOURCES.map(({ id, url, path, cycleYear, electionDate, note, postBody }) => ({ id, url, path, cycleYear, electionDate, note, postBody })),
  expectedContests: { "fl-2024-general-results-extract-txt": 123, "fl-2022-general-results-extract-txt": 13 },
  parse,
};
