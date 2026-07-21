import { createHash } from "node:crypto";
import {
  deriveElectionDecisionStatus,
  parseElectionDecisionSnapshotV1,
  type ElectionDecisionSnapshotV1,
} from "./gate";

export const ELECTION_DECISION_ADAPTER_VERSION = "election-decision-v1";
export const MAX_ELECTION_DECISION_ENVELOPE_BYTES = 128 * 1024;
export type ElectionDecisionEvidenceReceipt = Readonly<{
  snapshotId: string;
  lockEntryId: string;
  url: string;
  sha256: string;
  byteSize: number;
}>;
export type ElectionDecisionEnvelopeV1 = Readonly<{
  schemaVersion: 1;
  adapterVersion: typeof ELECTION_DECISION_ADAPTER_VERSION;
  sourceLockSha256: string;
  releaseCutoff: string;
  decisionSnapshotId: string;
  evidenceReceipts: readonly ElectionDecisionEvidenceReceipt[];
  decision: ElectionDecisionSnapshotV1;
}>;

const fail = (code: string): never => { throw new Error(code); };
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : fail("ELECTION_DECISION_ENVELOPE_INVALID");
const exact = (value: Record<string, unknown>, keys: readonly string[]) => {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !(key in value)))
    fail("ELECTION_DECISION_ENVELOPE_UNKNOWN_FIELD");
};
const bytewise = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(value);
const text = (value: unknown, maximum = 2048): value is string => typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value);
const https = (value: unknown): value is string => {
  if (!text(value)) return false;
  try { const parsed = new URL(value); return parsed.protocol === "https:" && !parsed.username && !parsed.password; } catch { return false; }
};

function validate(value: unknown): ElectionDecisionEnvelopeV1 {
  const root = object(value);
  exact(root, ["schemaVersion", "adapterVersion", "sourceLockSha256", "releaseCutoff", "decisionSnapshotId", "evidenceReceipts", "decision"]);
  if (root.schemaVersion !== 1 || root.adapterVersion !== ELECTION_DECISION_ADAPTER_VERSION || !sha(root.sourceLockSha256) || !date(root.releaseCutoff) || !id(root.decisionSnapshotId) || !Array.isArray(root.evidenceReceipts) || root.evidenceReceipts.length > 64)
    fail("ELECTION_DECISION_ENVELOPE_INVALID");
  const rawReceipts = root.evidenceReceipts as unknown[];
  const receipts: ElectionDecisionEvidenceReceipt[] = [];
  let previous = "";
  for (const raw of rawReceipts) {
    const receipt = object(raw);
    exact(receipt, ["snapshotId", "lockEntryId", "url", "sha256", "byteSize"]);
    const byteSize = receipt.byteSize;
    if (!id(receipt.snapshotId) || !id(receipt.lockEntryId) || !https(receipt.url) || !sha(receipt.sha256) || typeof byteSize !== "number" || !Number.isSafeInteger(byteSize) || byteSize < 0 || byteSize > 128 * 1024 * 1024 || (previous && bytewise(previous, receipt.snapshotId as string) >= 0))
      fail("ELECTION_DECISION_RECEIPT_INVALID");
    previous = receipt.snapshotId as string;
    receipts.push({ snapshotId: receipt.snapshotId as string, lockEntryId: receipt.lockEntryId as string, url: receipt.url as string, sha256: receipt.sha256 as string, byteSize: byteSize as number });
  }
  const decision = (() => { try { return parseElectionDecisionSnapshotV1(root.decision); } catch { return fail("ELECTION_DECISION_INVALID"); } })();
  if (deriveElectionDecisionStatus(decision.gates) === "unassessed") fail("ELECTION_DECISION_UNASSESSED");
  if (decision.evidenceSnapshotIds.length !== receipts.length || decision.evidenceSnapshotIds.some((snapshotId, index) => snapshotId !== receipts[index]?.snapshotId))
    fail("ELECTION_DECISION_RECEIPT_CLOSURE");
  return { schemaVersion: 1, adapterVersion: ELECTION_DECISION_ADAPTER_VERSION, sourceLockSha256: root.sourceLockSha256 as string, releaseCutoff: root.releaseCutoff as string, decisionSnapshotId: root.decisionSnapshotId as string, evidenceReceipts: receipts, decision };
}

export function encodeElectionDecisionEnvelope(value: unknown): Uint8Array {
  const envelope = validate(value);
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, adapterVersion: ELECTION_DECISION_ADAPTER_VERSION, sourceLockSha256: envelope.sourceLockSha256, releaseCutoff: envelope.releaseCutoff, decisionSnapshotId: envelope.decisionSnapshotId, evidenceReceipts: envelope.evidenceReceipts.map(receipt => ({ snapshotId: receipt.snapshotId, lockEntryId: receipt.lockEntryId, url: receipt.url, sha256: receipt.sha256, byteSize: receipt.byteSize })), decision: envelope.decision }));
  if (bytes.byteLength > MAX_ELECTION_DECISION_ENVELOPE_BYTES) fail("ELECTION_DECISION_ENVELOPE_TOO_LARGE");
  return bytes;
}
export function decodeElectionDecisionEnvelope(bytes: Uint8Array): ElectionDecisionEnvelopeV1 {
  if (bytes.byteLength > MAX_ELECTION_DECISION_ENVELOPE_BYTES) fail("ELECTION_DECISION_ENVELOPE_TOO_LARGE");
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { fail("ELECTION_DECISION_ENVELOPE_INVALID_JSON"); }
  const envelope = validate(parsed);
  if (!Buffer.from(bytes).equals(Buffer.from(encodeElectionDecisionEnvelope(envelope)))) fail("ELECTION_DECISION_ENVELOPE_NONCANONICAL");
  return envelope;
}
export const electionDecisionEnvelopeSha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
