import { XMLParser, XMLValidator } from "fast-xml-parser";

export type Chamber = "house" | "senate";
export type HouseDistrict = "AL" | `${number}${number}`;
export type OfficeKind = "representative" | "delegate" | "resident_commissioner" | "senator";
export type ReviewCode = "DUPLICATE_BIOGUIDE" | "DUPLICATE_OFFICE" | "MALFORMED_BIOGUIDE" | "MALFORMED_DATE" | "MALFORMED_STATE" | "MALFORMED_DISTRICT" | "MALFORMED_XML" | "MISSING_REQUIRED_FIELD" | "UNEXPECTED_SENATE_REPRESENTATION" | "SENATE_CLASS_PAIR" | "SERVICE_START_MAP_CONFLICT" | "MISSING_SERVICE_START" | "UNIVERSE_INCONSISTENCY";
export interface IdentityReviewError { readonly code: ReviewCode; readonly sourceNaturalKey: string; readonly message: string; }
export interface OfficeIdentity { readonly chamber: Chamber; readonly stateCode: string; readonly districtCode: HouseDistrict | null; readonly senateClass: 1 | 2 | 3 | null; readonly kind: OfficeKind; }
export interface PersonIdentity { readonly bioguideId: string; readonly displayName: string; }
export interface MembershipIdentity { readonly party: string | null; readonly termStartsAt: string | null; readonly termEndsAt: string | null; readonly electedAt: string | null; readonly swornAt: string | null; readonly serviceStartedAt: string | null; }
export interface NormalizedIdentityRecord { readonly sourceNaturalKey: string; readonly office: OfficeIdentity; readonly person: PersonIdentity | null; readonly membership: MembershipIdentity | null; readonly reviewErrors: readonly IdentityReviewError[]; }
export interface StagedIdentityRow { readonly sourceNaturalKey: string; readonly entityId: string; readonly sourceEntityId: string; readonly displayName: string; readonly officeChamber: Chamber; readonly officeStateCode: string; readonly officeDistrictCode: HouseDistrict | null; readonly officeSenateClass: 1 | 2 | 3 | null; readonly officeKind: OfficeKind; readonly membership: MembershipIdentity; readonly redactedExtras: Record<string, never>; }
export interface HouseSeat { readonly stateCode: string; readonly districtCode: HouseDistrict; readonly kind: Exclude<OfficeKind, "senator">; readonly termStartsAt?: string; readonly termEndsAt?: string; }
export interface HouseParseResult { readonly records: readonly NormalizedIdentityRecord[]; readonly errors: readonly IdentityReviewError[]; readonly blockedSeatKeys: readonly string[]; }

const MAX_XML_BYTES = 10 * 1024 * 1024;
const STATES = new Set("AL AK AS AZ AR CA CO CT DC DE FL GA GU HI IA ID IL IN KS KY LA MA MD ME MI MN MO MP MS MT NC ND NE NH NJ NM NV NY OH OK OR PA PR RI SC SD TN TX UT VA VI VT WA WI WV WY".split(" "));
const delegateStates = new Set(["DC", "AS", "GU", "MP", "VI"]);
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, trimValues: true });
const error = (code: ReviewCode, key: string, message: string): IdentityReviewError => ({ code, sourceNaturalKey: key, message });
const seatKey = (state: string, district: HouseDistrict | null): string => `${state}:${district}`;
const asArray = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : value === undefined ? [] : [value];
const text = (value: unknown): string | null => typeof value === "string" ? value : null;
const childText = (node: unknown, name: string): string | null => node !== null && typeof node === "object" ? text((node as Record<string, unknown>)[name]) : null;
const memberInfo = (node: unknown): Record<string, unknown> | null => node !== null && typeof node === "object" && !Array.isArray(node) ? node as Record<string, unknown> : null;
const validDate = (value: string | null): string | null => {
  if (!value || !/^\d{8}$/.test(value)) return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== iso ? null : iso;
};
const validIsoDate = (value: string | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const dateAttribute = (node: Record<string, unknown>, name: string): string | null => {
  const child = node[name];
  return child !== null && typeof child === "object" && !Array.isArray(child) ? text((child as Record<string, unknown>)["@_date"]) : null;
};
const expectedKind = (state: string): Exclude<OfficeKind, "senator"> => delegateStates.has(state) ? "delegate" : state === "PR" ? "resident_commissioner" : "representative";

function parseDocument(xml: string): { root: Record<string, unknown> | null; parseError: string | null } {
  if (Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES || /<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) return { root: null, parseError: "XML is too large or contains a forbidden declaration." };
  const validation = XMLValidator.validate(xml);
  if (validation !== true) return { root: null, parseError: validation.err.msg };
  try {
    const parsed: unknown = xmlParser.parse(xml);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { root: null, parseError: "XML document is not an object." };
    const document = parsed as Record<string, unknown>;
    if (!memberInfo(document.MemberData) || Object.keys(document).some(key => key !== "MemberData" && key !== "?xml")) return { root: null, parseError: "Expected exactly one MemberData root." };
    return { root: document.MemberData as Record<string, unknown>, parseError: null };
  } catch { return { root: null, parseError: "XML parser rejected the document." }; }
}

export function parseHouseRoster(xml: string): HouseParseResult {
  const document = parseDocument(xml);
  if (!document.root) return { records: [], errors: [error("MALFORMED_XML", "house-roster", document.parseError ?? "Malformed Clerk XML.")], blockedSeatKeys: [] };
  const members = document.root.members;
  if (!memberInfo(members) || !Object.prototype.hasOwnProperty.call(members, "member")) return { records: [], errors: [error("MALFORMED_XML", "house-roster", "MemberData must contain members.member.")], blockedSeatKeys: [] };
  const records: NormalizedIdentityRecord[] = []; const errors: IdentityReviewError[] = []; const blocked = new Set<string>(); const seen = new Set<string>();
  for (const member of asArray((members as Record<string, unknown>).member)) {
    const wrapper = memberInfo(member); const info = wrapper && Object.prototype.hasOwnProperty.call(wrapper, "member-info") ? memberInfo(wrapper["member-info"]) ?? {} : null;
    const rawDistrict = wrapper ? childText(wrapper, "statedistrict") ?? "" : "";
    const rawState = rawDistrict.slice(0, 2); const state = rawState === "AQ" ? "AS" : rawState; const districtRaw = rawDistrict.slice(2);
    const district = districtRaw === "00" ? "AL" : /^\d{2}$/.test(districtRaw) ? districtRaw as HouseDistrict : null;
    const bioguideId = info ? childText(info, "bioguideID") ?? "" : "";
    const key = `house:${rawDistrict || "unknown"}:${bioguideId || "unknown"}`; const rowErrors: IdentityReviewError[] = [];
    if (!wrapper || !info) rowErrors.push(error("MALFORMED_XML", key, "Each member must contain statedistrict and member-info."));
    if (!STATES.has(state)) rowErrors.push(error("MALFORMED_STATE", key, `Invalid House state ${state || "(missing)"}.`));
    if (!district) rowErrors.push(error("MALFORMED_DISTRICT", key, `Invalid House district ${districtRaw || "(missing)"}.`));
    const displayName = info ? childText(info, "official-name") ?? childText(info, "namelist") ?? "" : "";
    // The Clerk includes empty shells for vacant seats.  They identify a seat but
    // are not an occupied, malformed member row.
    if (!bioguideId && !displayName) { errors.push(...rowErrors); continue; }
    if (STATES.has(state) && district) blocked.add(seatKey(state, district));
    if (!/^[A-Z]\d{6}$/.test(bioguideId)) rowErrors.push(error("MALFORMED_BIOGUIDE", key, "Bioguide ID must be one letter followed by six digits."));
    else if (seen.has(bioguideId)) rowErrors.push(error("DUPLICATE_BIOGUIDE", key, `Duplicate Bioguide ID ${bioguideId}.`)); else seen.add(bioguideId);
    if (!displayName) rowErrors.push(error("MISSING_REQUIRED_FIELD", key, "Missing official member name."));
    const electedRaw = info ? dateAttribute(info, "elected-date") : null; const swornRaw = info ? dateAttribute(info, "sworn-date") : null;
    const electedAt = validDate(electedRaw); const swornAt = validDate(swornRaw);
    if (electedRaw !== null && !electedAt) rowErrors.push(error("MALFORMED_DATE", key, "Invalid elected-date."));
    if (swornRaw !== null && !swornAt) rowErrors.push(error("MALFORMED_DATE", key, "Invalid sworn-date."));
    if (!rowErrors.length) records.push({ sourceNaturalKey: `house:${state}:${district}`, office: { chamber: "house", stateCode: state, districtCode: district!, senateClass: null, kind: expectedKind(state) }, person: { bioguideId, displayName }, membership: { party: childText(info, "party"), termStartsAt: swornAt ?? electedAt, termEndsAt: null, electedAt, swornAt, serviceStartedAt: swornAt ?? electedAt }, reviewErrors: [] });
    errors.push(...rowErrors);
  }
  return { records, errors, blockedSeatKeys: [...blocked] };
}

export function reconcileHouseRoster(xml: string, universe: readonly HouseSeat[], releaseCutoff?: string): HouseParseResult {
  const parsed = parseHouseRoster(xml); const errors = [...parsed.errors]; const expected = new Map<string, HouseSeat>();
  if (releaseCutoff !== undefined && !validIsoDate(releaseCutoff)) errors.push(error("UNIVERSE_INCONSISTENCY", "house:release-cutoff", "Release cutoff must be a valid ISO date."));
  for (const seat of universe) {
    const key = seatKey(seat.stateCode, seat.districtCode);
    if (!STATES.has(seat.stateCode) || (seat.districtCode !== "AL" && !/^\d{2}$/.test(seat.districtCode)) || expectedKind(seat.stateCode) !== seat.kind || expected.has(key) || (seat.termStartsAt !== undefined && !validIsoDate(seat.termStartsAt)) || (seat.termEndsAt !== undefined && !validIsoDate(seat.termEndsAt)) || (seat.termStartsAt && seat.termEndsAt && seat.termStartsAt >= seat.termEndsAt)) errors.push(error("UNIVERSE_INCONSISTENCY", `house:${key}`, "House universe has an invalid, mismatched, or duplicate seat."));
    else expected.set(key, seat);
  }
  const occupied = new Set<string>();
  const records = parsed.records.map(record => {
    const key = seatKey(record.office.stateCode, record.office.districtCode); const seat = expected.get(key);
    if (!seat || seat.kind !== record.office.kind) { errors.push(error("UNIVERSE_INCONSISTENCY", record.sourceNaturalKey, "Roster office is outside the supplied House universe.")); return record; }
    occupied.add(key);
    const membership = record.membership!; const serviceStartedAt = membership.serviceStartedAt;
    if (!serviceStartedAt || (seat.termEndsAt && serviceStartedAt >= seat.termEndsAt) || (releaseCutoff && serviceStartedAt > releaseCutoff)) errors.push(error("MALFORMED_DATE", record.sourceNaturalKey, "Service start must precede the term end and release cutoff."));
    const termStartsAt = seat.termStartsAt && serviceStartedAt ? (serviceStartedAt > seat.termStartsAt ? serviceStartedAt : seat.termStartsAt) : serviceStartedAt;
    return { ...record, membership: { ...membership, serviceStartedAt, termStartsAt, termEndsAt: seat.termEndsAt ?? null } };
  });
  for (const key of parsed.blockedSeatKeys) if (!expected.has(key)) errors.push(error("UNIVERSE_INCONSISTENCY", `house:${key}`, "Malformed roster row identifies a seat outside the supplied House universe."));
  for (const [key, seat] of expected) if (!occupied.has(key) && !parsed.blockedSeatKeys.includes(key)) records.push({ sourceNaturalKey: `house:${key}`, office: { chamber: "house", stateCode: seat.stateCode, districtCode: seat.districtCode, senateClass: null, kind: seat.kind }, person: null, membership: null, reviewErrors: [] });
  return { records, errors, blockedSeatKeys: parsed.blockedSeatKeys };
}

export function toStagedIdentityRow(record: NormalizedIdentityRecord): StagedIdentityRow | null {
  if (!record.person || !record.membership) return null;
  return { sourceNaturalKey: record.sourceNaturalKey, entityId: record.person.bioguideId, sourceEntityId: record.person.bioguideId, displayName: record.person.displayName, officeChamber: record.office.chamber, officeStateCode: record.office.stateCode, officeDistrictCode: record.office.districtCode, officeSenateClass: record.office.senateClass, officeKind: record.office.kind, membership: record.membership, redactedExtras: {} };
}
