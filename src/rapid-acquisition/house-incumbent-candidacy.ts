import { housePriorityBriefsV10 } from "@/lib/house-priority-index";

import { readFecCandidateMaster, type FecCandidateMasterRow } from "./fec-candidate-master";
import { readPinnedPackage, readRetainedSource, readSourceLock, type SourceLock } from "./intake/source-lock";
import { readRefreshInputs, REFRESH_INPUTS } from "./refresh-inputs";
import { byteCompare, hash } from "./shared";

/**
 * What the FEC candidate master says about each House incumbent's 2026
 * candidacies. Two facts only: whether the incumbent's own House candidate
 * ids carry statutory candidate status for the cycle, and whether a Senate
 * candidate row in the same state matches the incumbent's name for 2026.
 *
 * The name gate for Senate filings: identical last-name key, then the FEC
 * first token must equal one of the roster's given-name tokens (first,
 * middle, nickname, official full name) or be an initial of one of them. A
 * filing whose first token is a bare initial that matches no roster token is
 * accepted only when the last name is unique among that state's 2026 Senate
 * filings; the basis is recorded on the row. Retirements and runs for state
 * office are not visible in federal filings and are left as "not_observed".
 */
export type OpenSeatSignal = "incumbent_filed_for_senate_2026" | null;

export interface HouseIncumbentCandidacyRow {
  readonly seatCycleId: string;
  readonly districtLabel: string;
  readonly bioguideId: string;
  readonly incumbentName: string;
  readonly houseCandidateIds: readonly string[];
  readonly houseStatutoryCandidate2026: boolean;
  readonly senateFilings: readonly Readonly<{ candidateId: string; candidateName: string; status: string | null; incumbentChallengerStatus: string | null; matchBasis: "given_name_token" | "given_name_initial" | "unique_last_name_in_state" }>[];
  readonly openSeatSignal: OpenSeatSignal;
  readonly rowSha256: string;
}

export interface HouseIncumbentCandidacy {
  readonly schema: "house-incumbent-candidacy-v1";
  readonly version: 1;
  readonly methodology: Readonly<{ source: string; snapshotDate: string; senateNameGate: "same_state_same_last_name_given_token_or_initial_or_unique_last_name"; retirementsAndStateOffice: "not_observed_in_federal_filings"; winnerInference: false }>;
  readonly sourceIds: readonly string[];
  readonly rows: readonly HouseIncumbentCandidacyRow[];
  readonly summary: Readonly<{ seats: 430; houseStatutoryCandidates: number; filedForSenate: number; noHouseRow: number }>;
  readonly rowSetSha256: string;
  readonly packageSha256: string;
}

export const HOUSE_INCUMBENT_CANDIDACY = {
  id: "house-incumbent-candidacy-v1",
  path: "data/metadata/house-incumbent-candidacy-v1.json",
  url: "urn:dsa-seats:house-incumbent-candidacy:v1",
  staticParentIds: ["congress-legislators-current-20260804", REFRESH_INPUTS.id],
  parentIds: (root: string, lock: SourceLock): string[] => { const inputs = readRefreshInputs(root, lock); return [...HOUSE_INCUMBENT_CANDIDACY.staticParentIds, inputs.fecCandidateMasterId ?? fail("MASTER_POINTER_MISSING")]; },
} as const;

type Legislator = { id?: { bioguide?: string; fec?: string[] }; name?: { first?: string; middle?: string; last?: string; nickname?: string; official_full?: string } };
const fail = (code: string): never => { throw new Error(`HOUSE_CANDIDACY_${code}`); };
const norm = (value: string): string => value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

export type SenateMatchBasis = "given_name_token" | "given_name_initial" | "unique_last_name_in_state";
export type RosterIdentity = { first: string; middle: string | null; nickname: string | null; officialFull: string | null; last: string };

export function senateFilingMatch(row: FecCandidateMasterRow, person: RosterIdentity, lastNameUniqueInState: boolean): SenateMatchBasis | null {
  const [fecLast, fecRest] = row.candidateName.split(",").map((part) => norm(part ?? ""));
  if (!fecLast || fecLast !== norm(person.last)) return null;
  const fecTokens = (fecRest ?? "").split(" ").filter((value) => value !== ""), token = fecTokens[0] ?? "";
  if (token === "") return null;
  const givenTokens = [person.first, person.middle, person.nickname, person.officialFull].filter((value): value is string => !!value).flatMap((value) => norm(value).split(" ")).filter((value) => value !== "" && value !== norm(person.last));
  // Any FEC given token may carry the roster name: "MOORE, FELIX BARRY" for Barry Moore.
  if (fecTokens.some((fecToken) => fecToken.length > 1 && givenTokens.includes(fecToken))) return "given_name_token";
  if (token.length === 1 && givenTokens.some((given) => given.startsWith(token))) return "given_name_initial";
  if (token.length === 1 && lastNameUniqueInState) return "unique_last_name_in_state";
  return null;
}

export function buildHouseIncumbentCandidacy(root = process.cwd(), lock: SourceLock = readSourceLock(root)): HouseIncumbentCandidacy {
  const inputs = readRefreshInputs(root, lock);
  const masterId = inputs.fecCandidateMasterId ?? fail("MASTER_POINTER_MISSING");
  const master = readFecCandidateMaster(lock, masterId, root);
  const byId = new Map(master.map((row) => [row.candidateId, row]));
  const senate2026 = master.filter((row) => row.office === "S" && row.electionYear === 2026 && row.status === "C");
  const congress = JSON.parse(readRetainedSource(lock, "congress-legislators-current-20260804", root).bytes.toString("utf8")) as Legislator[];
  const people = new Map(congress.flatMap((person) => person.id?.bioguide ? [[person.id.bioguide, person] as const] : []));

  const rows = housePriorityBriefsV10().map((brief): HouseIncumbentCandidacyRow => {
    const person = people.get(brief.bioguideId) ?? fail(`PERSON_MISSING:${brief.bioguideId}`);
    const houseCandidateIds = (person.id?.fec ?? []).filter((id) => id.startsWith("H")).sort(byteCompare);
    const houseRows = houseCandidateIds.map((id) => byId.get(id)).filter((row): row is FecCandidateMasterRow => row !== undefined);
    const identity: RosterIdentity = { first: person.name?.first ?? "", middle: person.name?.middle ?? null, nickname: person.name?.nickname ?? null, officialFull: person.name?.official_full ?? null, last: person.name?.last ?? "" };
    const stateFilings = senate2026.filter((row) => row.officeState === brief.stateCode);
    const sameLast = stateFilings.filter((row) => norm(row.candidateName.split(",")[0] ?? "") === norm(identity.last));
    const senateFilings = stateFilings.flatMap((row) => { const basis = senateFilingMatch(row, identity, sameLast.length === 1); return basis ? [{ candidateId: row.candidateId, candidateName: row.candidateName, status: row.status, incumbentChallengerStatus: row.incumbentChallengerStatus, matchBasis: basis }] : []; }).sort((left, right) => byteCompare(left.candidateId, right.candidateId));
    const unsigned = {
      seatCycleId: brief.seatCycleId, districtLabel: brief.districtLabel, bioguideId: brief.bioguideId, incumbentName: brief.officialHouseName,
      houseCandidateIds, houseStatutoryCandidate2026: houseRows.some((row) => row.electionYear === 2026 && row.status === "C"),
      senateFilings, openSeatSignal: (senateFilings.length > 0 ? "incumbent_filed_for_senate_2026" : null) as OpenSeatSignal,
    };
    return { ...unsigned, rowSha256: hash("dsa-seats:house-incumbent-candidacy-row:v1", unsigned) };
  }).sort((left, right) => byteCompare(left.seatCycleId, right.seatCycleId));
  if (rows.length !== 430) fail(`CLOSURE_INVALID:${rows.length}`);
  const summary = { seats: 430 as const, houseStatutoryCandidates: rows.filter((row) => row.houseStatutoryCandidate2026).length, filedForSenate: rows.filter((row) => row.openSeatSignal !== null).length, noHouseRow: rows.filter((row) => row.houseCandidateIds.length === 0).length };
  const unsigned = {
    schema: "house-incumbent-candidacy-v1" as const, version: 1 as const,
    methodology: { source: masterId, snapshotDate: inputs.snapshotDate, senateNameGate: "same_state_same_last_name_given_token_or_initial_or_unique_last_name" as const, retirementsAndStateOffice: "not_observed_in_federal_filings" as const, winnerInference: false as const },
    sourceIds: HOUSE_INCUMBENT_CANDIDACY.parentIds(root, lock), rows, summary, rowSetSha256: hash("dsa-seats:house-incumbent-candidacy-row-set:v1", rows),
  };
  return { ...unsigned, packageSha256: hash("dsa-seats:house-incumbent-candidacy-package:v1", unsigned) };
}

export function readHouseIncumbentCandidacy(root = process.cwd(), lock: SourceLock = readSourceLock(root)): HouseIncumbentCandidacy {
  const { value } = readPinnedPackage<HouseIncumbentCandidacy>(lock, HOUSE_INCUMBENT_CANDIDACY.id, "dsa-seats:house-incumbent-candidacy-package:v1", root);
  if (value.schema !== "house-incumbent-candidacy-v1" || value.summary.seats !== 430 || value.rows.length !== 430) fail("PINNED_INVALID");
  return value;
}
