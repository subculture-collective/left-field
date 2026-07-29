import { createHash } from "node:crypto";
import { isFecCandidateId } from "./values";

export type ScheduleEFormType = "F3X" | "F24" | "F5";
export type ScheduleEPositionName = "amount" | "backReferenceSchedule" | "backReferenceTransactionId" | "candidateId" | "disseminationDate" | "electionCode" | "expenditureDate" | "filerId" | "memoCode" | "supportOppose" | "transactionId";
export type ScheduleEPositions = Readonly<Record<ScheduleEPositionName, number | null>>;

export type SanitizedScheduleERecord = Readonly<{
  fileNumber: number;
  filerId: string;
  canonicalFormType: ScheduleEFormType;
  electionCode: string;
  candidateId: string;
  supportOppose: "S" | "O";
  disseminationDate: string;
  expenditureDate: string | null;
  amountCents: bigint;
  transactionIdSha256: string;
  backReferenceIdSha256: string | null;
  backReferenceScheduleSha256: string | null;
  memoCode: "X" | null;
  noticeCode: null | "24" | "48";
  isNotice: boolean;
}>;

export const scheduleESanitizationErrorCodes = ["FEC_SCHEDULE_E_INPUT_INVALID", "FEC_SCHEDULE_E_FIELD_INVALID", "FEC_SCHEDULE_E_POSITION_INVALID", "FEC_SCHEDULE_E_VALUE_INVALID"] as const;
export type ScheduleESanitizationErrorCode = (typeof scheduleESanitizationErrorCodes)[number];
export type ParseSanitizedScheduleERecordInput = Readonly<{ fields: readonly Uint8Array[]; positions: ScheduleEPositions; fileNumber: number; canonicalFormType: ScheduleEFormType; noticeCode: null | "24" | "48" }>;

const MAX_FIELD_BYTES = 16 * 1024;
const MAX_CENTS_TEXT = "9223372036854775807";
const MAX_CENTS = BigInt(MAX_CENTS_TEXT);
const requiredPositions = ["amount", "candidateId", "disseminationDate", "electionCode", "filerId", "supportOppose", "transactionId"] as const;
const optionalPositions = ["backReferenceSchedule", "backReferenceTransactionId", "expenditureDate", "memoCode"] as const;
const sePositions: ScheduleEPositions = { amount: 21, backReferenceSchedule: 5, backReferenceTransactionId: 4, candidateId: 28, disseminationDate: 20, electionCode: 18, expenditureDate: 22, filerId: 2, memoCode: 43, supportOppose: 27, transactionId: 3 };
const f57Positions: ScheduleEPositions = { amount: 19, backReferenceSchedule: null, backReferenceTransactionId: null, candidateId: 25, disseminationDate: 18, electionCode: 16, expenditureDate: null, filerId: 2, memoCode: null, supportOppose: 24, transactionId: 3 };
const fail = (code: ScheduleESanitizationErrorCode): never => { throw new Error(code); };
const isByteArray = (value: unknown): value is Uint8Array => ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === "[object Uint8Array]";

/** Decodes bounded ASCII fields without allowing control bytes or implicit text coercion. */
function ascii(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_FIELD_BYTES) fail("FEC_SCHEDULE_E_FIELD_INVALID");
  let value = "";
  for (const byte of bytes) {
    if (byte < 0x20 || byte > 0x7e) fail("FEC_SCHEDULE_E_FIELD_INVALID");
    value += String.fromCharCode(byte);
  }
  return value;
}

function field(input: ParseSanitizedScheduleERecordInput, name: ScheduleEPositionName): string | null {
  const position = input.positions[name];
  if (position === null) return null;
  if (!Number.isSafeInteger(position) || position < 1 || position > input.fields.length) fail("FEC_SCHEDULE_E_POSITION_INVALID");
  const value = input.fields[position - 1];
  if (!isByteArray(value)) fail("FEC_SCHEDULE_E_INPUT_INVALID");
  return ascii(value);
}

function date(value: string, required: boolean): string | null {
  if (value === "" && !required) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) fail("FEC_SCHEDULE_E_VALUE_INVALID");
  const month = match![1]!;
  const day = match![2]!;
  const year = match![3]!;
  const result = `${year}-${month}-${day}`;
  const parsed = new Date(`${result}T00:00:00.000Z`);
  try { if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) fail("FEC_SCHEDULE_E_VALUE_INVALID"); } catch { fail("FEC_SCHEDULE_E_VALUE_INVALID"); }
  return result;
}

function cents(value: string): bigint {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) fail("FEC_SCHEDULE_E_VALUE_INVALID");
  const digits = `${match![1]!}${(match![2] ?? "").padEnd(2, "0")}`.replace(/^0+(?=\d)/, "");
  if (!/^\d{1,19}$/.test(digits) || digits.length === 19 && digits > MAX_CENTS_TEXT) fail("FEC_SCHEDULE_E_VALUE_INVALID");
  return BigInt(digits);
}

function hash(domain: string, value: string): string {
  return createHash("sha256").update(domain, "ascii").update(value, "ascii").digest("hex");
}

/** Strict, lossless projection of a workbook-positioned Schedule E row. */
export function parseSanitizedScheduleERecord(input: ParseSanitizedScheduleERecordInput): SanitizedScheduleERecord {
  if (input === null || typeof input !== "object" || !Array.isArray(input.fields) || !(input.noticeCode === null || input.noticeCode === "24" || input.noticeCode === "48") || !["F3X", "F24", "F5"].includes(input.canonicalFormType) || (input.canonicalFormType === "F3X" && input.noticeCode !== null) || (input.canonicalFormType === "F24" && input.noticeCode === null)) fail("FEC_SCHEDULE_E_INPUT_INVALID");
  const lockedPositions = input.canonicalFormType === "F5" ? f57Positions : sePositions;
  if ((Object.keys(lockedPositions) as ScheduleEPositionName[]).some(name => input.positions[name] !== lockedPositions[name])) fail("FEC_SCHEDULE_E_POSITION_INVALID");
  for (const name of requiredPositions) if (input.positions[name] === null) fail("FEC_SCHEDULE_E_POSITION_INVALID");
  for (const name of optionalPositions) if (input.positions[name] !== null && (!Number.isSafeInteger(input.positions[name]) || input.positions[name]! < 1)) fail("FEC_SCHEDULE_E_POSITION_INVALID");
  const fileNumber = input.fileNumber;
  if (!Number.isSafeInteger(fileNumber) || fileNumber <= 0) fail("FEC_SCHEDULE_E_VALUE_INVALID");
  const filerId = field(input, "filerId")!;
  const candidateId = field(input, "candidateId")!;
  const electionCode = field(input, "electionCode")!;
  const supportOppose = field(input, "supportOppose")!;
  const transactionId = field(input, "transactionId")!;
  const memoCode = field(input, "memoCode");
  const expenditure = field(input, "expenditureDate");
  const backReferenceId = field(input, "backReferenceTransactionId");
  const backReferenceSchedule = field(input, "backReferenceSchedule");
  if (!/^[A-Z0-9]{9}$/.test(filerId) || !isFecCandidateId(candidateId) || !/^[A-Z][0-9]{4}$/.test(electionCode) || (supportOppose !== "S" && supportOppose !== "O") || transactionId === "" || (memoCode !== null && memoCode !== "" && memoCode !== "X")) fail("FEC_SCHEDULE_E_VALUE_INVALID");
  if (backReferenceId === null || backReferenceSchedule === null) {
    if (backReferenceId !== null && backReferenceId !== "") fail("FEC_SCHEDULE_E_POSITION_INVALID");
    if (backReferenceSchedule !== null && backReferenceSchedule !== "") fail("FEC_SCHEDULE_E_POSITION_INVALID");
  }
  return { fileNumber, filerId, canonicalFormType: input.canonicalFormType, electionCode, candidateId, supportOppose: supportOppose as "S" | "O", disseminationDate: date(field(input, "disseminationDate")!, true)!, expenditureDate: expenditure === null ? null : date(expenditure, false), amountCents: cents(field(input, "amount")!), transactionIdSha256: hash("fec-schedule-e:transaction-id:v1\0", transactionId), backReferenceIdSha256: backReferenceId === null || backReferenceId === "" ? null : hash("fec-schedule-e:back-reference-id:v1\0", backReferenceId), backReferenceScheduleSha256: backReferenceSchedule === null || backReferenceSchedule === "" ? null : hash("fec-schedule-e:back-reference-schedule:v1\0", backReferenceSchedule), memoCode: memoCode === "" || memoCode === null ? null : "X", noticeCode: input.noticeCode, isNotice: input.noticeCode !== null };
}

/** Validates the complete, retained domain projection (not its JSON wire form). */
export function validateSanitizedScheduleERecord(raw: unknown): SanitizedScheduleERecord {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) fail("FEC_SCHEDULE_E_INPUT_INVALID");
  const r = raw as Record<string, unknown>, keys = ["fileNumber", "filerId", "canonicalFormType", "electionCode", "candidateId", "supportOppose", "disseminationDate", "expenditureDate", "amountCents", "transactionIdSha256", "backReferenceIdSha256", "backReferenceScheduleSha256", "memoCode", "noticeCode", "isNotice"];
  if (Object.keys(r).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(r, key)) || !Number.isSafeInteger(r.fileNumber) || (r.fileNumber as number) <= 0 || typeof r.filerId !== "string" || !/^[A-Z0-9]{9}$/.test(r.filerId) || !["F3X", "F24", "F5"].includes(r.canonicalFormType as string) || typeof r.electionCode !== "string" || !/^[A-Z][0-9]{4}$/.test(r.electionCode) || typeof r.candidateId !== "string" || !isFecCandidateId(r.candidateId) || (r.supportOppose !== "S" && r.supportOppose !== "O") || typeof r.disseminationDate !== "string" || date(r.disseminationDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1"), true) !== r.disseminationDate || !(r.expenditureDate === null || typeof r.expenditureDate === "string" && date(r.expenditureDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1"), true) === r.expenditureDate) || typeof r.amountCents !== "bigint" || r.amountCents < BigInt(0) || r.amountCents > MAX_CENTS || typeof r.transactionIdSha256 !== "string" || !/^[a-f0-9]{64}$/.test(r.transactionIdSha256) || !(r.backReferenceIdSha256 === null || typeof r.backReferenceIdSha256 === "string" && /^[a-f0-9]{64}$/.test(r.backReferenceIdSha256)) || !(r.backReferenceScheduleSha256 === null || typeof r.backReferenceScheduleSha256 === "string" && /^[a-f0-9]{64}$/.test(r.backReferenceScheduleSha256)) || !(r.memoCode === null || r.memoCode === "X") || !(r.noticeCode === null || r.noticeCode === "24" || r.noticeCode === "48") || r.isNotice !== (r.noticeCode !== null) || (r.canonicalFormType === "F3X" && r.noticeCode !== null) || (r.canonicalFormType === "F24" && !(r.noticeCode === "24" || r.noticeCode === "48"))) fail("FEC_SCHEDULE_E_VALUE_INVALID");
  return r as SanitizedScheduleERecord;
}
