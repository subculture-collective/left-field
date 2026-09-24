import { readPinnedPackage, readRetainedSource, readSourceLock, type SourceLock } from "./intake/source-lock";
import { readRefreshInputs, REFRESH_INPUTS } from "./refresh-inputs";
import { hash } from "./shared";
import { STATE_LEGISLATIVE_PRIMARY_CONTEXT, type StateLegislativePrimaryContext } from "./state-legislative-primary-context";

/**
 * Nationwide state-legislative seat roster from the Open States people CSVs
 * (CC0), one row per sitting legislator in all fifty states plus DC, joined
 * to the retained Democratic primary catalogs where one exists.
 *
 * What this layer can and cannot say:
 * - Holder, party, chamber, and district for every seat: yes.
 * - Direct Democratic primary evidence for the holder: only in the ten
 *   catalog states, and only when the holder's given and family name match a
 *   candidate in the latest retained Democratic primary for that seat.
 * - A district-level partisan baseline: no. No open nationwide 2024
 *   presidential-by-legislative-district file exists, so these seats are not
 *   ranked. The reason is recorded in `methodology.presidentialBaseline`.
 */
export type StateChamber = "lower" | "upper" | "unicameral";
export type RosterParty = "Democratic" | "Republican" | "Independent" | "Other";

export interface StateLegislativeRosterRow {
  readonly seatId: string;
  readonly stateCode: string;
  readonly chamber: StateChamber;
  readonly district: string;
  readonly districtKey: string;
  readonly seatSlot: number;
  readonly openStatesId: string;
  readonly name: string;
  readonly givenName: string;
  readonly familyName: string;
  readonly party: RosterParty;
  readonly rawParty: string;
  readonly primaryEvidence: Readonly<{
    status: "matched" | "holder_not_in_latest_primary" | "no_contest_retained" | "catalog_not_joined" | "not_democratic_holder" | "no_catalog_for_state";
    catalogId: string | null;
    cycleYear: number | null;
    contestId: string | null;
    incumbentVotes: number | null;
    contestVotes: number | null;
    incumbentVoteShare: number | null;
    primaryFeasibility: number | null;
    namedCandidates: number | null;
  }>;
  readonly rowSha256: string;
}

export interface StateLegislativeRoster {
  readonly schema: "state-legislative-roster-v1";
  readonly version: 1;
  readonly snapshotDate: string;
  readonly methodology: Readonly<{
    source: "openstates_people_current_csv_cc0";
    identityGate: "exact_normalized_given_and_family_name_in_latest_retained_democratic_primary";
    primaryFeasibility: "one_hundred_minus_holder_share_of_named_candidate_votes";
    presidentialBaseline: "unavailable_no_open_nationwide_2024_legislative_district_file";
    ranking: "not_ranked_until_a_district_baseline_is_retained";
    winnerInference: false;
  }>;
  readonly sourceIds: readonly string[];
  readonly rows: readonly StateLegislativeRosterRow[];
  readonly summary: Readonly<{
    jurisdictions: number;
    legislators: number;
    chambers: number;
    democraticHolders: number;
    republicanHolders: number;
    independentHolders: number;
    otherHolders: number;
    multiMemberDistricts: number;
    catalogStates: number;
    primaryMatched: number;
    holdersNotInLatestPrimary: number;
    matchedContestVotes: number;
  }>;
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

export const STATE_LEGISLATIVE_ROSTER = {
  id: "state-legislative-roster-v1",
  path: "data/metadata/state-legislative-roster-v1.json",
  url: "urn:dsa-seats:state-legislative-roster:v1",
  catalogIds: [
    "rapid-indiana-state-legislative-primary-results-v1", "rapid-georgia-state-legislative-primary-results-v1", "rapid-north-carolina-state-legislative-primary-results-v1",
    "rapid-alabama-state-legislative-primary-results-v1", "rapid-delaware-state-legislative-primary-results-v1", "rapid-hawaii-state-legislative-primary-results-v1",
    "rapid-missouri-state-legislative-primary-results-v1", "rapid-kentucky-state-legislative-primary-results-v1", "rapid-ohio-state-legislative-democratic-primary-results-v1",
    "rapid-tennessee-state-legislative-primary-results-v1",
  ],
  parentIds: (root: string, lock: SourceLock): string[] => [REFRESH_INPUTS.id, STATE_LEGISLATIVE_PRIMARY_CONTEXT.id, ...STATE_LEGISLATIVE_ROSTER.catalogIds, ...readRefreshInputs(root, lock).stateLegislativeRosterIds],
} as const;

/** Per-catalog reading rules: Democratic party labels, chamber spellings, district field, and whether candidates are listed. */
const CATALOGS: Readonly<Record<string, { state: string; democraticLabels: readonly string[]; chambers: Readonly<Record<string, StateChamber>>; districtField: "district" | "districtCode"; candidates: "candidates" | "sourceObservations" }>> = {
  "rapid-indiana-state-legislative-primary-results-v1": { state: "IN", democraticLabels: ["D"], chambers: { lower: "lower", upper: "upper" }, districtField: "district", candidates: "candidates" },
  "rapid-georgia-state-legislative-primary-results-v1": { state: "GA", democraticLabels: ["D"], chambers: { lower: "lower", upper: "upper" }, districtField: "district", candidates: "candidates" },
  "rapid-north-carolina-state-legislative-primary-results-v1": { state: "NC", democraticLabels: ["D"], chambers: { lower: "lower", upper: "upper" }, districtField: "district", candidates: "candidates" },
  "rapid-alabama-state-legislative-primary-results-v1": { state: "AL", democraticLabels: ["DEM"], chambers: { lower: "lower", upper: "upper" }, districtField: "district", candidates: "candidates" },
  "rapid-delaware-state-legislative-primary-results-v1": { state: "DE", democraticLabels: ["Democratic Party"], chambers: { lower: "lower", upper: "upper" }, districtField: "district", candidates: "candidates" },
  "rapid-hawaii-state-legislative-primary-results-v1": { state: "HI", democraticLabels: ["D"], chambers: { lower: "lower", upper: "upper" }, districtField: "district", candidates: "candidates" },
  "rapid-missouri-state-legislative-primary-results-v1": { state: "MO", democraticLabels: ["Democratic"], chambers: { lower: "lower", upper: "upper" }, districtField: "district", candidates: "candidates" },
  "rapid-kentucky-state-legislative-primary-results-v1": { state: "KY", democraticLabels: ["Democratic"], chambers: { lower: "lower", upper: "upper" }, districtField: "district", candidates: "candidates" },
  "rapid-ohio-state-legislative-democratic-primary-results-v1": { state: "OH", democraticLabels: ["DEM"], chambers: { state_house: "lower", state_senate: "upper" }, districtField: "districtCode", candidates: "candidates" },
  "rapid-tennessee-state-legislative-primary-results-v1": { state: "TN", democraticLabels: ["D"], chambers: { lower: "lower", upper: "upper" }, districtField: "district", candidates: "sourceObservations" },
};

const one = (value: number): number => Math.round(value * 10) / 10;
const fail = (code: string): never => { throw new Error(`STATE_LEG_ROSTER_${code}`); };
const norm = (value: string): string => value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
/** Numeric districts compare by value; named districts keep their digits ("Rockingham 13" is not "Rockingham 1"). */
export const districtKey = (district: string): string => /^\d+$/.test(district.trim()) ? String(Number(district.trim())) : district.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Minimal RFC 4180 reader; Open States quotes fields containing commas, quotes, or newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') { if (text[index + 1] === '"') { value += '"'; index++; } else quoted = false; }
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (value !== "" || row.length) { row.push(value); rows.push(row); }
  return rows.filter((cells) => cells.length > 1 || cells[0] !== "");
}

const chamberOf = (value: string): StateChamber => value === "lower" ? "lower" : value === "upper" ? "upper" : value === "legislature" ? "unicameral" : fail(`CHAMBER_INVALID:${value}`);
const partyOf = (value: string): RosterParty => {
  const key = value.toLowerCase();
  if (key.startsWith("democrat")) return "Democratic";
  if (key.startsWith("republican")) return "Republican";
  if (key.startsWith("independent") || key === "nonpartisan" || key === "") return "Independent";
  return "Other";
};

type Contest = { contestId: string; cycleYear: number; chamber: StateChamber; districtKey: string; candidates: { name: string; votes: number }[] };

function catalogContests(lock: SourceLock, id: string, root: string): Contest[] {
  const rules = CATALOGS[id] ?? fail(`CATALOG_RULES_MISSING:${id}`);
  const catalog = JSON.parse(readRetainedSource(lock, id, root).bytes.toString("utf8")) as { contests?: Record<string, unknown>[] };
  if (!Array.isArray(catalog.contests)) fail(`CATALOG_SHAPE:${id}`);
  const contests: Contest[] = [];
  for (const contest of catalog.contests!) {
    if (!rules.democraticLabels.includes(String(contest.rawParty))) continue;
    const chamber = rules.chambers[String(contest.chamber)];
    if (!chamber) fail(`CATALOG_CHAMBER:${id}:${String(contest.chamber)}`);
    const list = (contest[rules.candidates] as Record<string, unknown>[] | undefined) ?? [];
    const candidates = list
      .filter((row) => rules.candidates !== "sourceObservations" || row.entryKind === "source_named_candidate")
      .map((row) => ({ name: String(row.sourceName ?? row.candidateName ?? row.name ?? ""), votes: Number(row.votes ?? row.totalVotes ?? 0) }));
    if (candidates.some((row) => !Number.isSafeInteger(row.votes) || row.votes < 0)) fail(`CATALOG_VOTES:${id}`);
    contests.push({ contestId: String(contest.contestId), cycleYear: Number(contest.cycleYear), chamber: chamber!, districtKey: districtKey(String(contest[rules.districtField] ?? "")), candidates });
  }
  return contests;
}

export function buildStateLegislativeRoster(root = process.cwd(), lock: SourceLock = readSourceLock(root)): StateLegislativeRoster {
  const inputs = readRefreshInputs(root, lock);
  readPinnedPackage<StateLegislativePrimaryContext>(lock, STATE_LEGISLATIVE_PRIMARY_CONTEXT.id, "dsa-seats:rapid-state-legislative-primary-context-package:v1", root);
  const latestByCatalog = new Map<string, Map<string, Contest>>();
  for (const id of STATE_LEGISLATIVE_ROSTER.catalogIds) {
    const latest = new Map<string, Contest>();
    for (const contest of catalogContests(lock, id, root)) {
      const key = `${contest.chamber}|${contest.districtKey}`, current = latest.get(key);
      if (!current || contest.cycleYear > current.cycleYear) latest.set(key, contest);
    }
    latestByCatalog.set(CATALOGS[id]!.state, latest);
  }
  const catalogByState = new Map(STATE_LEGISLATIVE_ROSTER.catalogIds.map((id) => [CATALOGS[id]!.state, id]));

  const rows: StateLegislativeRosterRow[] = [];
  const states = new Set<string>();
  for (const rosterId of inputs.stateLegislativeRosterIds) {
    const stateCode = (rosterId.match(/^openstates-people-([a-z]{2})-\d{8}$/)?.[1] ?? fail(`ROSTER_ID_INVALID:${rosterId}`)).toUpperCase();
    states.add(stateCode);
    const table = parseCsv(readRetainedSource(lock, rosterId, root).bytes.toString("utf8"));
    const header = table[0] ?? fail(`ROSTER_EMPTY:${rosterId}`);
    const column = (name: string): number => { const index = header.indexOf(name); return index >= 0 ? index : fail(`ROSTER_COLUMN_MISSING:${rosterId}:${name}`); };
    const idCol = column("id"), nameCol = column("name"), partyCol = column("current_party"), districtCol = column("current_district"), chamberCol = column("current_chamber"), givenCol = column("given_name"), familyCol = column("family_name");
    const members = table.slice(1).map((cells) => ({ openStatesId: cells[idCol]!, name: cells[nameCol]!, rawParty: cells[partyCol]!, district: cells[districtCol]!, chamber: chamberOf(cells[chamberCol]!), givenName: cells[givenCol]!, familyName: cells[familyCol]! }))
      .sort((left, right) => left.chamber.localeCompare(right.chamber) || districtKey(left.district).localeCompare(districtKey(right.district)) || left.familyName.localeCompare(right.familyName) || left.givenName.localeCompare(right.givenName) || left.openStatesId.localeCompare(right.openStatesId));
    const slots = new Map<string, number>();
    for (const member of members) {
      const key = districtKey(member.district), slotKey = `${member.chamber}|${key}`, seatSlot = (slots.get(slotKey) ?? 0) + 1;
      slots.set(slotKey, seatSlot);
      const party = partyOf(member.rawParty);
      const catalogId = catalogByState.get(stateCode) ?? null;
      let evidence: StateLegislativeRosterRow["primaryEvidence"] = { status: catalogId ? "not_democratic_holder" : "no_catalog_for_state", catalogId, cycleYear: null, contestId: null, incumbentVotes: null, contestVotes: null, incumbentVoteShare: null, primaryFeasibility: null, namedCandidates: null };
      if (party === "Democratic" && catalogId) {
        const contest = latestByCatalog.get(stateCode)!.get(slotKey);
        if (!contest) evidence = { ...evidence, status: "no_contest_retained" };
        else {
          const given = norm(member.givenName).split(" ")[0] ?? "", family = norm(member.familyName);
          const matches = contest.candidates.filter((candidate) => { const tokens = norm(candidate.name).split(" "); return family !== "" && tokens.includes(family) && (given === "" || tokens[0] === given || tokens.includes(given)); });
          const total = contest.candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
          if (matches.length === 1 && total > 0) {
            const share = one((matches[0]!.votes / total) * 100);
            evidence = { status: "matched", catalogId, cycleYear: contest.cycleYear, contestId: contest.contestId, incumbentVotes: matches[0]!.votes, contestVotes: total, incumbentVoteShare: share, primaryFeasibility: one(100 - share), namedCandidates: contest.candidates.length };
          } else evidence = { status: "holder_not_in_latest_primary", catalogId, cycleYear: contest.cycleYear, contestId: contest.contestId, incumbentVotes: null, contestVotes: total, incumbentVoteShare: null, primaryFeasibility: null, namedCandidates: contest.candidates.length };
        }
      }
      const unsigned = { seatId: `seat_state_${stateCode.toLowerCase()}_${member.chamber}_${key.replace(/ /g, "-")}_${seatSlot}`, stateCode, chamber: member.chamber, district: member.district, districtKey: key, seatSlot, openStatesId: member.openStatesId, name: member.name, givenName: member.givenName, familyName: member.familyName, party, rawParty: member.rawParty, primaryEvidence: evidence };
      rows.push({ ...unsigned, rowSha256: hash("dsa-seats:state-legislative-roster-row:v1", unsigned) });
    }
  }
  rows.sort((left, right) => left.seatId.localeCompare(right.seatId));
  if (new Set(rows.map((row) => row.seatId)).size !== rows.length) fail("SEAT_ID_DUPLICATE");
  const multi = new Set(rows.filter((row) => row.seatSlot > 1).map((row) => `${row.stateCode}|${row.chamber}|${row.districtKey}`));
  const matched = rows.filter((row) => row.primaryEvidence.status === "matched");
  const summary = {
    jurisdictions: states.size,
    legislators: rows.length,
    chambers: new Set(rows.map((row) => `${row.stateCode}|${row.chamber}`)).size,
    democraticHolders: rows.filter((row) => row.party === "Democratic").length,
    republicanHolders: rows.filter((row) => row.party === "Republican").length,
    independentHolders: rows.filter((row) => row.party === "Independent").length,
    otherHolders: rows.filter((row) => row.party === "Other").length,
    multiMemberDistricts: multi.size,
    catalogStates: STATE_LEGISLATIVE_ROSTER.catalogIds.length,
    primaryMatched: matched.length,
    holdersNotInLatestPrimary: rows.filter((row) => row.primaryEvidence.status === "holder_not_in_latest_primary").length,
    matchedContestVotes: matched.reduce((sum, row) => sum + (row.primaryEvidence.contestVotes ?? 0), 0),
  };
  const unsigned = {
    schema: "state-legislative-roster-v1" as const,
    version: 1 as const,
    snapshotDate: inputs.snapshotDate,
    methodology: { source: "openstates_people_current_csv_cc0" as const, identityGate: "exact_normalized_given_and_family_name_in_latest_retained_democratic_primary" as const, primaryFeasibility: "one_hundred_minus_holder_share_of_named_candidate_votes" as const, presidentialBaseline: "unavailable_no_open_nationwide_2024_legislative_district_file" as const, ranking: "not_ranked_until_a_district_baseline_is_retained" as const, winnerInference: false as const },
    sourceIds: STATE_LEGISLATIVE_ROSTER.parentIds(root, lock),
    rows,
    summary,
    rowSetSha256: hash("dsa-seats:state-legislative-roster-row-set:v1", rows),
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:state-legislative-roster-package:v1", unsigned) };
}

export function readStateLegislativeRoster(root = process.cwd(), lock: SourceLock = readSourceLock(root)): StateLegislativeRoster {
  const { value } = readPinnedPackage<StateLegislativeRoster>(lock, STATE_LEGISLATIVE_ROSTER.id, "dsa-seats:state-legislative-roster-package:v1", root);
  if (value.schema !== "state-legislative-roster-v1" || value.version !== 1 || value.methodology.winnerInference !== false || !Array.isArray(value.rows) || value.rows.length !== value.summary.legislators) fail("PINNED_INVALID");
  return value;
}
