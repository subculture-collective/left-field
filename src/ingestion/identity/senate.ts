import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { IdentityReviewError, NormalizedIdentityRecord } from "./house";

export interface SenateSeat { readonly stateCode: string; readonly senateClass: 1 | 2 | 3; readonly termStartsAt?: string; readonly termEndsAt?: string; }
export interface SenateJurisdictionPolicy { readonly noSenateJurisdictions: ReadonlySet<string>; }
export type SenateServiceStartMap = Readonly<Record<string, string>>;
export interface SenateServiceStartRosterEntry { readonly state: string; readonly senateClass: 1 | 2 | 3; }
export interface SenateParseResult { readonly records: readonly NormalizedIdentityRecord[]; readonly errors: readonly IdentityReviewError[]; }
const MAX_XML_BYTES = 10 * 1024 * 1024;
const SENATE_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));
const NO_SENATE_JURISDICTIONS = new Set(["DC", "PR", "AS", "GU", "MP", "VI"]);
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true });
const error = (code: IdentityReviewError["code"], key: string, message: string): IdentityReviewError => ({ code, sourceNaturalKey: key, message });
const asArray = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : value === undefined ? [] : [value];
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const field = (node: Record<string, unknown>, name: string): string | null => typeof node[name] === "string" ? node[name] as string : null;
const isoDate = (value: string | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const hasExactKeys = (node: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(node);
  return actual.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(node, key));
};
const SENATE_SERVICE_STARTS_CHRONOLOGY_SOURCE = "data/source/identity/senate-chronological-list.txt";

/** Strictly loads the reviewed, source-locked Senate chronology extract. */
export function parseSenateServiceStartsArtifact(json: string, roster?: Readonly<Record<string, SenateServiceStartRosterEntry>>): SenateServiceStartMap {
  let artifact: unknown;
  try { artifact = JSON.parse(json); } catch { throw new Error("Senate service-start artifact is not valid JSON."); }
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) throw new Error("Senate service-start artifact must be an object.");
  const root = artifact as Record<string, unknown>; const entries = root.entries;
  if (!hasExactKeys(root, ["schemaVersion", "chronologySource", "chronologyDated", "entries"]) || root.schemaVersion !== 1 || root.chronologySource !== SENATE_SERVICE_STARTS_CHRONOLOGY_SOURCE || !isoDate(typeof root.chronologyDated === "string" ? root.chronologyDated : undefined) || !entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error("Senate service-start artifact has an unsupported schema.");
  const result: Record<string, string> = {};
  const rows = Object.entries(entries as Record<string, unknown>);
  if (rows.length !== 100) throw new Error("Senate service-start artifact must contain exactly 100 entries.");
  for (const [id, value] of rows) {
    const entry = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
    const evidence = entry && entry.evidence && typeof entry.evidence === "object" && !Array.isArray(entry.evidence) ? entry.evidence as Record<string, unknown> : null;
    if (!/^[A-Z]\d{6}$/.test(id) || !entry || !hasExactKeys(entry, ["state", "senateClass", "displayName", "initialServiceDate", "evidence"]) || !isoDate(typeof entry.initialServiceDate === "string" ? entry.initialServiceDate : undefined) || typeof entry.state !== "string" || !SENATE_STATES.has(entry.state) || ![1, 2, 3].includes(entry.senateClass as number) || typeof entry.displayName !== "string" || !entry.displayName.trim() || !evidence || !hasExactKeys(evidence, ["line", "text"]) || !Number.isSafeInteger(evidence.line) || (evidence.line as number) <= 0 || typeof evidence.text !== "string" || !evidence.text.trim()) throw new Error(`Invalid Senate service-start entry: ${id}.`);
    const expected = roster?.[id];
    if (roster && (!expected || expected.state !== entry.state || expected.senateClass !== entry.senateClass)) throw new Error(`Senate service-start roster conflict: ${id}.`);
    result[id] = entry.initialServiceDate as string;
  }
  if (roster && Object.keys(roster).some(id => !result[id])) throw new Error("Senate service-start roster has IDs absent from the artifact.");
  return result;
}

export function parseSenateRoster(xml: string, serviceStarts: SenateServiceStartMap): SenateParseResult {
  if (Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES || /<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) return { records: [], errors: [error("MALFORMED_XML", "senate-roster", "XML is too large or contains a forbidden declaration.")] };
  const validation = XMLValidator.validate(xml);
  if (validation !== true) return { records: [], errors: [error("MALFORMED_XML", "senate-roster", validation.err.msg)] };
  let root: Record<string, unknown> | null;
  try { const document = object(parser.parse(xml)); root = document && !Object.keys(document).some(key => key !== "contact_information" && key !== "?xml") ? object(document.contact_information) : null; } catch { root = null; }
  if (!root || !Object.prototype.hasOwnProperty.call(root, "member")) return { records: [], errors: [error("MALFORMED_XML", "senate-roster", "Expected exactly one contact_information root with member entries.")] };
  const records: NormalizedIdentityRecord[] = []; const errors: IdentityReviewError[] = []; const ids = new Set<string>(); const offices = new Set<string>();
  for (const raw of asArray(root.member)) {
    const member = object(raw); const state = member ? field(member, "state") ?? "" : ""; const bioguideId = member ? field(member, "bioguide_id") ?? "" : ""; const classText = member ? field(member, "class") ?? "" : "";
    const senateClass = ({ "Class I": 1, "Class II": 2, "Class III": 3 } as const)[classText]; const key = `senate:${state || "unknown"}:${senateClass ?? "unknown"}:${bioguideId || "unknown"}`; const rowErrors: IdentityReviewError[] = [];
    if (!member) rowErrors.push(error("MALFORMED_XML", key, "Each Senate member must be an XML object."));
    if (!/^[A-Z]{2}$/.test(state)) rowErrors.push(error("MALFORMED_STATE", key, "Invalid Senate state."));
    if (!/^[A-Z]\d{6}$/.test(bioguideId)) rowErrors.push(error("MALFORMED_BIOGUIDE", key, "Bioguide ID must be one letter followed by six digits.")); else if (ids.has(bioguideId)) rowErrors.push(error("DUPLICATE_BIOGUIDE", key, `Duplicate Bioguide ID ${bioguideId}.`)); else ids.add(bioguideId);
    if (!senateClass) rowErrors.push(error("SENATE_CLASS_PAIR", key, "Senate class must be Class I, II, or III."));
    const officeKey = senateClass ? `${state}:${senateClass}` : ""; if (officeKey && offices.has(officeKey)) rowErrors.push(error("DUPLICATE_OFFICE", key, `Duplicate Senate class ${officeKey}.`)); else if (officeKey) offices.add(officeKey);
    const displayName = member ? [field(member, "first_name"), field(member, "last_name")].filter((part): part is string => !!part).join(" ") : ""; if (!displayName) rowErrors.push(error("MISSING_REQUIRED_FIELD", key, "Missing senator name."));
    const serviceStart = serviceStarts[bioguideId]; if (!isoDate(serviceStart)) rowErrors.push(error(serviceStart ? "SERVICE_START_MAP_CONFLICT" : "MISSING_SERVICE_START", key, "An exact valid Senate service-start date is required for this Bioguide ID."));
    if (!rowErrors.length) records.push({ sourceNaturalKey: `senate:${state}:${senateClass}`, office: { chamber: "senate", stateCode: state, districtCode: null, senateClass: senateClass!, kind: "senator" }, person: { bioguideId, displayName }, membership: { party: field(member!, "party"), termStartsAt: serviceStart, termEndsAt: null, electedAt: null, swornAt: null, serviceStartedAt: serviceStart }, reviewErrors: [] });
    errors.push(...rowErrors);
  }
  for (const id of Object.keys(serviceStarts)) if (!ids.has(id)) errors.push(error("SERVICE_START_MAP_CONFLICT", `senate:service-start:${id}`, "Service-start map contains a Bioguide ID absent from the roster."));
  return { records, errors };
}

export function reconcileSenateRoster(xml: string, universe: readonly SenateSeat[], policy: SenateJurisdictionPolicy, serviceStarts: SenateServiceStartMap, releaseCutoff?: string): SenateParseResult {
  const parsed = parseSenateRoster(xml, serviceStarts); const errors = [...parsed.errors]; const expected = new Map<string, SenateSeat>();
  if (policy.noSenateJurisdictions.size !== NO_SENATE_JURISDICTIONS.size || [...NO_SENATE_JURISDICTIONS].some(state => !policy.noSenateJurisdictions.has(state))) errors.push(error("UNIVERSE_INCONSISTENCY", "senate:no-senate-policy", "No-Senate jurisdiction policy must exactly identify DC, PR, and territories."));
  if (releaseCutoff !== undefined && !isoDate(releaseCutoff)) errors.push(error("UNIVERSE_INCONSISTENCY", "senate:release-cutoff", "Release cutoff must be a valid ISO date."));
  for (const seat of universe) { const key = `${seat.stateCode}:${seat.senateClass}`; if (!SENATE_STATES.has(seat.stateCode) || policy.noSenateJurisdictions.has(seat.stateCode) || ![1, 2, 3].includes(seat.senateClass) || expected.has(key) || (seat.termStartsAt !== undefined && !isoDate(seat.termStartsAt)) || (seat.termEndsAt !== undefined && !isoDate(seat.termEndsAt)) || (seat.termStartsAt && seat.termEndsAt && seat.termStartsAt >= seat.termEndsAt)) errors.push(error("UNIVERSE_INCONSISTENCY", `senate:${key}`, "Senate universe contains an invalid or duplicate seat.")); else expected.set(key, seat); }
  if (expected.size !== 100) errors.push(error("UNIVERSE_INCONSISTENCY", "senate:universe", "Senate universe must contain exactly 100 seat/class records."));
  for (const state of new Set([...expected.values()].map(seat => seat.stateCode))) if ([...expected.values()].filter(seat => seat.stateCode === state).length !== 2) errors.push(error("SENATE_CLASS_PAIR", `senate:${state}`, "Each eligible state must have exactly two distinct Senate classes."));
  for (const record of parsed.records) if (policy.noSenateJurisdictions.has(record.office.stateCode)) errors.push(error("UNEXPECTED_SENATE_REPRESENTATION", record.sourceNaturalKey, "Roster contains a senator from a no-Senate jurisdiction."));
  const records = [...parsed.records]; const occupied = new Set<string>();
  for (const record of parsed.records) { const key = `${record.office.stateCode}:${record.office.senateClass}`; const seat = expected.get(key); const serviceStartedAt = record.membership!.serviceStartedAt; if (!seat) errors.push(error("SENATE_CLASS_PAIR", record.sourceNaturalKey, "Roster seat is outside the supplied Senate universe.")); else { occupied.add(key); if ((seat.termEndsAt && serviceStartedAt! >= seat.termEndsAt) || (releaseCutoff && serviceStartedAt! > releaseCutoff)) errors.push(error("MALFORMED_DATE", record.sourceNaturalKey, "Service start must precede the term end and release cutoff.")); const termStartsAt = seat.termStartsAt && serviceStartedAt! > seat.termStartsAt ? serviceStartedAt : seat.termStartsAt ?? serviceStartedAt; records[records.indexOf(record)] = { ...record, membership: { ...record.membership!, serviceStartedAt, termStartsAt, termEndsAt: seat.termEndsAt ?? null } }; } }
  for (const [key, seat] of expected) if (!occupied.has(key)) records.push({ sourceNaturalKey: `senate:${key}`, office: { chamber: "senate", stateCode: seat.stateCode, districtCode: null, senateClass: seat.senateClass, kind: "senator" }, person: null, membership: null, reviewErrors: [] });
  return { records, errors };
}
