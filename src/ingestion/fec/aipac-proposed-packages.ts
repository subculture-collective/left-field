import { createHash } from "node:crypto";
import { z } from "zod";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime({ offset: true });
const cycles = z.union([z.literal(2022), z.literal(2024), z.literal(2026)]);
const proposedReview = z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() });

const sourceArtifact = z.strictObject({
  id: z.string().min(1),
  kind: z.string().min(1),
  url: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  sha256,
  memberName: z.string().min(1).nullable(),
  memberByteSize: z.number().int().nonnegative().nullable(),
  memberSha256: sha256.nullable(),
  retrievedAt: isoDateTime,
});

const pageReceipt = z.strictObject({
  cycleYear: cycles,
  pass: z.union([z.literal(1), z.literal(2)]),
  ordinal: z.number().int().positive(),
  requestSha256: sha256,
  bodySha256: sha256,
  byteSize: z.number().int().nonnegative(),
  resultCount: z.number().int().nonnegative(),
  cursorIn: z.strictObject({ date: isoDate, index: z.string().min(1) }).nullable(),
  cursorOut: z.strictObject({ date: isoDate, index: z.string().min(1) }).nullable(),
  terminal: z.boolean(),
});

const filing = z.strictObject({
  committeeId: z.enum(["C00797670", "C00799031"]),
  cycleYear: cycles,
  fileNumber: z.number().int().positive(),
  previousFileNumber: z.number().int().positive().nullable(),
  amendmentChain: z.array(z.number().int().positive()),
  amendmentIndicator: z.string().min(1).nullable(),
  amendmentVersion: z.number().int().nonnegative().nullable(),
  formType: z.string().min(1),
  reportType: z.string().min(1).nullable(),
  receiptDate: isoDate,
  coverageStartDate: isoDate.nullable(),
  coverageEndDate: isoDate.nullable(),
  meansFiled: z.string().min(1).nullable(),
  identitySha256: sha256,
});

export const aipacEvidenceClosureProposalSchema = z.strictObject({
  schema: z.literal("aipac-evidence-closure-proposal-v1"),
  version: z.literal(1),
  sourceCutoff: isoDate,
  generatedAt: isoDateTime,
  cycles: z.tuple([z.literal(2022), z.literal(2024), z.literal(2026)]),
  filingLedgers: z.array(z.strictObject({
    committeeId: z.enum(["C00797670", "C00799031"]),
    endpoint: z.literal("https://api.open.fec.gov/v1/filings/"),
    completePasses: z.literal(2),
    terminalEmptyPages: z.literal(true),
    passDigestSha256: sha256,
    sourcePages: z.array(pageReceipt),
    filings: z.array(filing),
  })).length(2),
  scheduleE: z.strictObject({
    committeeId: z.literal("C00799031"),
    endpoint: z.literal("https://api.open.fec.gov/v1/schedules/schedule_e/"),
    completePasses: z.literal(2),
    terminalEmptyPages: z.literal(true),
    passDigestSha256: sha256,
    sourcePages: z.array(pageReceipt),
    records: z.array(z.strictObject({
      cycleYear: cycles,
      committeeId: z.literal("C00799031"),
      candidateId: z.string().regex(/^[HSP][A-Z0-9]{8}$/).nullable(),
      candidateOffice: z.enum(["H", "S", "P"]).nullable(),
      candidateOfficeState: z.string().length(2).nullable(),
      candidateOfficeDistrict: z.string().min(1).nullable(),
      candidateParty: z.string().min(1).nullable(),
      fileNumber: z.number().int().positive(),
      previousFileNumber: z.number().int().positive().nullable(),
      amendmentIndicator: z.string().min(1).nullable(),
      amendmentNumber: z.number().int().nonnegative().nullable(),
      mostRecent: z.boolean().nullable(),
      filingDate: isoDate,
      filingForm: z.string().min(1),
      electionType: z.string().min(1).nullable(),
      supportOppose: z.enum(["S", "O"]),
      amount: z.number().finite(),
      expenditureDate: isoDate.nullable(),
      disseminationDate: isoDate.nullable(),
      transactionIdSha256: sha256,
      subIdSha256: sha256,
      originalSubIdSha256: sha256.nullable(),
      linkIdSha256: sha256.nullable(),
      memoCode: z.enum(["X"]).nullable(),
      memoedSubtotal: z.boolean(),
      isNotice: z.boolean().nullable(),
      recordIdentitySha256: sha256,
    })),
  }),
  review: proposedReview,
  packageSha256: sha256,
});

export const aipacMappingProposalSchema = z.strictObject({
  schema: z.literal("aipac-candidate-seat-mappings-proposal-v1"),
  version: z.literal(1),
  releaseId: z.string().min(1),
  sourceCutoff: isoDate,
  generatedAt: isoDateTime,
  sourceArtifacts: z.array(sourceArtifact).min(10),
  targetUniverse: z.strictObject({ expected: z.literal(212), observed: z.literal(212), allHaveFecCandidateId: z.literal(true) }),
  proposedDecisions: z.array(z.strictObject({
    decisionId: z.string().min(1),
    status: z.enum(["proposed", "needs_review", "rejected"]),
    candidateId: z.string().regex(/^[HSP][A-Z0-9]{8}$/),
    seatCycleId: z.string().min(1),
    relationship: z.enum(["incumbent", "democratic_primary_challenger"]),
    effectiveCycleYears: z.array(cycles).min(1),
    office: z.literal("H"),
    state: z.string().length(2),
    district: z.string().min(1),
    party: z.literal("DEM"),
    authorizedCommitteeIdsByCycle: z.array(z.strictObject({ cycleYear: cycles, committeeIds: z.array(z.string().regex(/^C\d{8}$/)), principalCommitteeCrosscheck: z.enum(["matched", "missing", "conflict"]) })),
    rationaleCodes: z.array(z.string().min(1)).min(1),
    inferred: z.boolean(),
    evidenceRecordSha256s: z.array(sha256).min(1),
  })).min(1),
  review: proposedReview,
  packageSha256: sha256,
});

export const aipacNetworkClassificationProposalSchema = z.strictObject({
  schema: z.literal("org-classification-aipac-network-proposal-v1"),
  version: z.literal(1),
  generatedAt: isoDateTime,
  classification: z.strictObject({
    subjectCommitteeId: z.literal("C00799031"),
    relationship: z.literal("aipac_backed_super_pac"),
    networkRootCommitteeId: z.literal("C00797670"),
    confidence: z.literal("primary_source_explicit"),
    status: z.literal("proposed"),
  }),
  sources: z.array(z.strictObject({ snapshotId: z.string().min(1), url: z.url(), byteSize: z.number().int().positive(), artifactSha256: sha256, retrievedAt: isoDateTime, sourceKind: z.enum(["aipac_primary_statement", "fec_committee_record"]), retainedExcerptSha256: sha256 })),
  review: proposedReview,
  packageSha256: sha256,
});

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export const sha256Text = (domain: string, value: string): string => createHash("sha256").update(domain, "utf8").update(value, "utf8").digest("hex");
export const packageSha256 = (value: Record<string, unknown>): string => sha256Text("dsa-seats:aipac-proposed-package:v1\0", canonicalJson(value));

export function attachAndValidatePackageSha256<T extends Record<string, unknown>>(value: T): T & { packageSha256: string } {
  return { ...value, packageSha256: packageSha256(value) };
}

export function validateProposedPackage(value: unknown): void {
  const parsed = aipacEvidenceClosureProposalSchema.safeParse(value).success || aipacMappingProposalSchema.safeParse(value).success || aipacNetworkClassificationProposalSchema.safeParse(value).success;
  if (!parsed || value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("AIPAC_PROPOSED_PACKAGE_INVALID");
  const row = value as Record<string, unknown>;
  const { packageSha256: declared, ...unsigned } = row;
  if (declared !== packageSha256(unsigned)) throw new Error("AIPAC_PROPOSED_PACKAGE_HASH_MISMATCH");
  const serialized = JSON.stringify(value).toLowerCase();
  for (const prohibited of ["candidate_name", "payee_name", "payee_street", "expenditure_description", "memo_text", "treasurer_name", "bank_depository"]) if (serialized.includes(prohibited)) throw new Error("AIPAC_PROPOSED_PACKAGE_PRIVACY_VIOLATION");
}
