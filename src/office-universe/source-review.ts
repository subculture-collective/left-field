import type { IntakeDecision, IntakeIssue, RetainedObjectReceipt, SnapshotDisposition, SourceDefinition } from "./nationwide-intake";
import { RAW_INTAKE_KINDS, SHA256_HEX, STATE_CODES, isIsoUtc, isUnsafeLocator } from "./nationwide-intake";

export type SourceReview = Readonly<{ status: "reviewed" | "rejected"; issues: readonly IntakeIssue[] }>;
export type SnapshotAssessment = Readonly<{ disposition: SnapshotDisposition; issues: readonly IntakeIssue[]; quarantinedRowCount: number }>;
export type SnapshotAssessmentInput = Readonly<{
  receipts: readonly RetainedObjectReceipt[];
  recordDecisions: readonly IntakeDecision[];
  /** When supplied, receipts must belong to this reviewed source and its host. */
  source?: SourceDefinition;
  /** When supplied, every receipt must have been produced by this parser. */
  expectedParserVersion?: string;
}>;

/** Any one of these on a row is a fault in the snapshot, not in the row. */
export const SYSTEMIC_ISSUE_CODES: ReadonlySet<string> = new Set([
  "SOURCE_AUTHORITY_MISMATCH", "PARSER_DRIFT", "RECONCILIATION_FAILED", "CERTIFICATION_AMBIGUOUS",
  "RECEIPT_MISSING", "RECEIPT_UNVERIFIED", "RECEIPT_INVALID", "SOURCE_NOT_REVIEWED",
]);
const FAMILIES = new Set(["discovery", "elections", "finance", "geography", "officeholders"]);
const KINDS = new Set<string>(RAW_INTAKE_KINDS);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const httpsHost = (value: unknown): string | null => {
  if (!text(value)) return null;
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname ? url.hostname : null; } catch { return null; }
};

/** Fail-closed review: every field must be present and in scope, or the source is rejected. */
export function reviewSourceDefinition(definition: SourceDefinition): SourceReview {
  const d = definition as Readonly<Record<keyof SourceDefinition, unknown>>;
  const issues: IntakeIssue[] = [];
  const reject = (code: string, diagnostic: string) => issues.push({ code, diagnostic });
  if (!text(d.id)) reject("SOURCE_ID_MISSING", "source id is blank");
  if (!(STATE_CODES as readonly unknown[]).includes(d.stateCode)) reject("STATE_CODE_INVALID", "stateCode is not a two-letter state");
  if (!FAMILIES.has(d.family as string)) reject("SOURCE_FAMILY_INVALID", "family is not a registry source family");
  if (!text(d.sourceKey)) reject("SOURCE_KEY_MISSING", "sourceKey is blank");
  if (d.authorityTier !== "official" && d.authorityTier !== "aggregator") reject("AUTHORITY_TIER_INVALID", "authorityTier must be official or aggregator");
  if (!Array.isArray(d.authorityScope) || d.authorityScope.length === 0 || !d.authorityScope.every(text))
    reject("AUTHORITY_SCOPE_EMPTY", "authorityScope must name at least one scope");
  if (typeof d.precedence !== "number" || !Number.isInteger(d.precedence) || d.precedence <= 0) reject("PRECEDENCE_INVALID", "precedence must be a positive integer");
  if (httpsHost(d.sourceUrl) === null) reject("SOURCE_URL_NOT_HTTPS", "sourceUrl must be an https URL");
  if (!text(d.retentionBasis)) reject("RETENTION_BASIS_MISSING", "retentionBasis is required before bytes are retained");
  if (!Array.isArray(d.allowedKinds) || d.allowedKinds.length === 0 || !d.allowedKinds.every((kind) => KINDS.has(kind as string)) || new Set(d.allowedKinds).size !== d.allowedKinds.length)
    reject("ALLOWED_KINDS_INVALID", "allowedKinds must be a nonempty set of intake kinds");
  if (d.privacyPolicy === "finance_allowlist") reject("FINANCE_ALLOWLIST_UNREVIEWED", "finance sources are blocked until a source-specific privacy allowlist is reviewed");
  else if (d.privacyPolicy !== "public_office_only") reject("PRIVACY_POLICY_INVALID", "privacyPolicy is not a known policy");
  if (d.family === "finance" && d.privacyPolicy === "public_office_only") reject("FINANCE_POLICY_MISMATCH", "finance family cannot use the public-office policy");
  if (d.status === "rejected" || d.status === "retired") reject("SOURCE_STATUS_CLOSED", `a ${d.status} source cannot be re-reviewed in place`);
  else if (d.status !== "draft" && d.status !== "reviewed") reject("SOURCE_STATUS_INVALID", "status is not a source definition status");
  return { status: issues.length ? "rejected" : "reviewed", issues };
}

function receiptIssues(receipt: RetainedObjectReceipt, input: SnapshotAssessmentInput): IntakeIssue[] {
  const issues: IntakeIssue[] = [];
  const finalHost = httpsHost(receipt.finalUrl);
  if (!text(receipt.sourceId) || isUnsafeLocator(receipt.locator) || !Number.isInteger(receipt.byteSize) || receipt.byteSize <= 0
    || !SHA256_HEX.test(receipt.sha256) || !isIsoUtc(receipt.retrievedAt) || finalHost === null || !text(receipt.parserVersion))
    issues.push({ code: "RECEIPT_INVALID", diagnostic: `receipt ${receipt.locator} is malformed` });
  if (receipt.verified !== true) issues.push({ code: "RECEIPT_UNVERIFIED", diagnostic: `receipt ${receipt.locator} has not passed retained-object verification` });
  if (input.source && (receipt.sourceId !== input.source.id || finalHost !== httpsHost(input.source.sourceUrl)))
    issues.push({ code: "SOURCE_AUTHORITY_MISMATCH", diagnostic: `receipt ${receipt.locator} was not retrieved from reviewed source ${input.source.id}` });
  if (input.expectedParserVersion !== undefined && receipt.parserVersion !== input.expectedParserVersion)
    issues.push({ code: "PARSER_DRIFT", diagnostic: `receipt ${receipt.locator} parser ${receipt.parserVersion} differs from ${input.expectedParserVersion}` });
  return issues;
}

/**
 * Snapshot-level disposition. Receipt, authority, parser, reconciliation, and
 * certification faults are systemic and quarantine the whole snapshot. Row
 * faults quarantine only their rows, and the snapshot is still accepted.
 */
export function assessSnapshot(input: SnapshotAssessmentInput): SnapshotAssessment {
  const issues: IntakeIssue[] = [];
  if (input.source && input.source.status !== "reviewed") issues.push({ code: "SOURCE_NOT_REVIEWED", diagnostic: `source ${input.source.id} is ${input.source.status}` });
  if (input.receipts.length === 0) issues.push({ code: "RECEIPT_MISSING", diagnostic: "a snapshot requires at least one retained-object receipt" });
  for (const receipt of input.receipts) issues.push(...receiptIssues(receipt, input));
  for (const decision of input.recordDecisions) for (const issue of decision.issues) if (SYSTEMIC_ISSUE_CODES.has(issue.code)) issues.push(issue);
  const quarantinedRowCount = input.recordDecisions.filter((decision) => decision.disposition === "quarantined").length;
  const disposition: SnapshotDisposition = issues.length ? "quarantined" : quarantinedRowCount ? "accepted_with_row_quarantine" : "accepted";
  return { disposition, issues, quarantinedRowCount };
}
