import { createHash } from "node:crypto";
import { type FinanceCoverageOutcome } from "@/domain/contracts";
import { createFecEfoSanitizer, encodeFecSanitizedFilingArtifact, fecEfoSanitizerErrorCodes, type FecEfoSanitizerErrorCode, type FecEfoSanitizerOptions, type FecSanitizedFilingArtifactV2 } from "./efo-sanitizer";
import { type FecEfoLayout } from "./efo-layout";
import { FecV2TransportError, streamFecDocqueryFiling, FecV2RunBudget, type FecV2Dependencies, type FecV2FecUrl, type FecV2Receipt } from "./fetch-client-v2";
import { decodeFecFilingIdentityV1, encodeFecFilingIdentityV1, fecFilingIdentitySha256, type FecFilingIdentityV1 } from "./filing-ledger";
import { type VersionedArtifactReceipt, type VersionedRawObjectStore, type VersionedStoreActivation } from "./versioned-artifact-store";

export const FEC_SANITIZED_FILING_ACQUISITION_ERRORS = ["FEC_SANITIZED_ACQUISITION_ABORTED", "FEC_SANITIZED_ACQUISITION_DEADLINE", "FEC_SANITIZED_ACQUISITION_INPUT", "FEC_SANITIZED_ACQUISITION_TRANSPORT", "FEC_SANITIZED_ACQUISITION_SANITIZER", "FEC_SANITIZED_ACQUISITION_UNSUPPORTED_LAYOUT", "FEC_SANITIZED_ACQUISITION_MALFORMED_FILING", "FEC_SANITIZED_ACQUISITION_UNAVAILABLE", "FEC_SANITIZED_ACQUISITION_RECEIPT", "FEC_SANITIZED_ACQUISITION_STORE", "FEC_SANITIZED_ACQUISITION_ACTIVATION"] as const;
export type FecSanitizedFilingAcquisitionErrorCode = typeof FEC_SANITIZED_FILING_ACQUISITION_ERRORS[number];
export type FecSanitizedFilingProcessingOutcome = Extract<FinanceCoverageOutcome, "paper_filing_unreviewed" | "source_unavailable" | "unsupported_layout" | "malformed_filing">;
export class FecSanitizedFilingAcquisitionError extends Error {
  constructor(readonly code: FecSanitizedFilingAcquisitionErrorCode, readonly processingOutcome?: FecSanitizedFilingProcessingOutcome) {
    super(code); this.name = "FecSanitizedFilingAcquisitionError";
  }
}
type Base = Readonly<{ planSha256: string; ledgerIdentitySha256: string; identity: FecFilingIdentityV1; layout: FecEfoLayout; budget: FecV2RunBudget; fecUrl: FecV2FecUrl; store: VersionedRawObjectStore; activation: VersionedStoreActivation; signal: AbortSignal; deadlineMs: number }>;
export type FecSanitizedFilingAcquisitionOptions = Base;
export type FecSanitizedFilingAcquisitionTestingOptions = Base & Readonly<{ streamer: typeof streamFecDocqueryFiling; dependencies?: FecV2Dependencies; sanitizerLimits?: Pick<FecEfoSanitizerOptions, "artifactByteLimit" | "rawByteLimit"> }>;
export type FecSanitizedFilingAcquisitionResult = Readonly<{ artifact: FecSanitizedFilingArtifactV2; artifactSha256: string; artifactByteSize: number; receipt: VersionedArtifactReceipt; upstreamProvenance: Readonly<Pick<FecV2Receipt, "requestSha256" | "upstreamBodySha256" | "bytes" | "retrievedAt">> }>;
export type FecLocalResearchSanitizedFilingResult = Omit<FecSanitizedFilingAcquisitionResult, "receipt">;
export type FecLocalResearchSanitizedFilingOptions = Readonly<{ planSha256: string; ledgerIdentitySha256: string; identity: FecFilingIdentityV1; layout: FecEfoLayout; budget: FecV2RunBudget; fecUrl: FecV2FecUrl; signal: AbortSignal; deadlineMs: number; dependencies?: FecV2Dependencies; streamer?: typeof streamFecDocqueryFiling; sanitizerLimits?: Pick<FecEfoSanitizerOptions, "artifactByteLimit" | "rawByteLimit"> }>;

const SHA = /^[a-f0-9]{64}$/;
const fail = (code: FecSanitizedFilingAcquisitionErrorCode, processingOutcome?: FecSanitizedFilingProcessingOutcome): never => { throw new FecSanitizedFilingAcquisitionError(code, processingOutcome); };
const sanitizerCode = (error: unknown): FecEfoSanitizerErrorCode | undefined => {
  if (!(error instanceof Error)) return undefined;
  return fecEfoSanitizerErrorCodes.find(code => code === error.message);
};
const mapSanitizer = (error: unknown): never => {
  switch (sanitizerCode(error)) {
    case "FEC_EFO_SANITIZER_ABORTED": return fail("FEC_SANITIZED_ACQUISITION_ABORTED");
    case "FEC_EFO_SANITIZER_DEADLINE": return fail("FEC_SANITIZED_ACQUISITION_DEADLINE");
    case "FEC_EFO_SANITIZER_UNSUPPORTED_LAYOUT": return fail("FEC_SANITIZED_ACQUISITION_UNSUPPORTED_LAYOUT", "unsupported_layout");
    case "FEC_EFO_SANITIZER_MALFORMED": case "FEC_EFO_SANITIZER_LIMIT": return fail("FEC_SANITIZED_ACQUISITION_MALFORMED_FILING", "malformed_filing");
    default: return fail("FEC_SANITIZED_ACQUISITION_SANITIZER");
  }
};
const mapTransport = (error: unknown): never => {
  if (error instanceof FecV2TransportError) {
    if (error.code === "FEC_V2_ABORTED") return fail("FEC_SANITIZED_ACQUISITION_ABORTED");
    if (error.code === "FEC_V2_DEADLINE" || error.code === "FEC_V2_TIMEOUT") return fail("FEC_SANITIZED_ACQUISITION_DEADLINE");
    if (error.code === "FEC_V2_SOURCE_UNAVAILABLE") return fail("FEC_SANITIZED_ACQUISITION_UNAVAILABLE", "source_unavailable");
  }
  return fail("FEC_SANITIZED_ACQUISITION_TRANSPORT");
};
const hasOwnDataKeys = (value: object, keys: readonly string[]): boolean => {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(value).length === keys.length && keys.every(key => {
    const descriptor = descriptors[key]; return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
  });
};
type Snapshot = Base & Readonly<{ streamer: typeof streamFecDocqueryFiling; dependencies?: FecV2Dependencies; sanitizerLimits?: Pick<FecEfoSanitizerOptions, "artifactByteLimit" | "rawByteLimit"> }>;
const testingValues = (input: FecSanitizedFilingAcquisitionOptions | FecSanitizedFilingAcquisitionTestingOptions): Readonly<{ streamer: typeof streamFecDocqueryFiling; dependencies?: FecV2Dependencies; sanitizerLimits?: Pick<FecEfoSanitizerOptions, "artifactByteLimit" | "rawByteLimit"> }> | undefined => {
  const candidate: Base & Partial<Readonly<{ streamer: typeof streamFecDocqueryFiling; dependencies?: FecV2Dependencies; sanitizerLimits?: Pick<FecEfoSanitizerOptions, "artifactByteLimit" | "rawByteLimit"> }>> = input;
  return typeof candidate.streamer === "function" ? { streamer: candidate.streamer, dependencies: candidate.dependencies, sanitizerLimits: candidate.sanitizerLimits } : undefined;
};
function snapshot(input: FecSanitizedFilingAcquisitionOptions | FecSanitizedFilingAcquisitionTestingOptions, testing: boolean): Snapshot {
  const keys = testing ? ["planSha256", "ledgerIdentitySha256", "identity", "layout", "budget", "fecUrl", "store", "activation", "signal", "deadlineMs", "streamer", "dependencies", "sanitizerLimits"] : ["planSha256", "ledgerIdentitySha256", "identity", "layout", "budget", "fecUrl", "store", "activation", "signal", "deadlineMs"];
  if (input === null || typeof input !== "object" || Object.getPrototypeOf(input) !== Object.prototype || !hasOwnDataKeys(input, keys)) fail("FEC_SANITIZED_ACQUISITION_INPUT");
  const { planSha256, ledgerIdentitySha256, identity, layout, budget, fecUrl, store, activation, signal, deadlineMs } = input;
  if (!SHA.test(planSha256) || !SHA.test(ledgerIdentitySha256) || !(signal instanceof AbortSignal) || !Number.isFinite(deadlineMs) || !(budget instanceof FecV2RunBudget) || budget.signal !== signal || budget.deadline !== deadlineMs || typeof fecUrl !== "string" || store === null || typeof store !== "object") fail("FEC_SANITIZED_ACQUISITION_INPUT");
  const detachedIdentity = (() => { try { return decodeFecFilingIdentityV1(encodeFecFilingIdentityV1(identity)); } catch { return fail("FEC_SANITIZED_ACQUISITION_INPUT"); } })();
  if (fecFilingIdentitySha256(detachedIdentity) !== ledgerIdentitySha256) fail("FEC_SANITIZED_ACQUISITION_INPUT");
  if (detachedIdentity.electronicStatus === "paper") fail("FEC_SANITIZED_ACQUISITION_UNAVAILABLE", "paper_filing_unreviewed");
  if (detachedIdentity.rawAvailability !== "available") fail("FEC_SANITIZED_ACQUISITION_UNAVAILABLE", "source_unavailable");
  if (testing) {
    const test = testingValues(input); if (!test) return fail("FEC_SANITIZED_ACQUISITION_INPUT");
    return Object.freeze({ planSha256, ledgerIdentitySha256, identity: detachedIdentity, layout, budget, fecUrl, store, activation, signal, deadlineMs, streamer: test.streamer, ...(test.dependencies === undefined ? {} : { dependencies: test.dependencies }), ...(test.sanitizerLimits === undefined ? {} : { sanitizerLimits: test.sanitizerLimits }) });
  }
  return Object.freeze({ planSha256, ledgerIdentitySha256, identity: detachedIdentity, layout, budget, fecUrl, store, activation, signal, deadlineMs, streamer: streamFecDocqueryFiling });
}
async function sanitize(x: Pick<Snapshot, "planSha256" | "ledgerIdentitySha256" | "identity" | "layout" | "budget" | "fecUrl" | "signal" | "deadlineMs" | "streamer" | "dependencies" | "sanitizerLimits">): Promise<FecLocalResearchSanitizedFilingResult> {
  const context = Object.freeze({ signal: x.signal, deadlineMs: x.deadlineMs });
  const sanitizer = createFecEfoSanitizer({ planSha256: x.planSha256, ledgerIdentitySha256: x.ledgerIdentitySha256, identity: x.identity, layout: x.layout, ...x.sanitizerLimits }, context);
  const upstream: FecV2Receipt = await x.streamer({ budget: x.budget, fecUrl: x.fecUrl, expectedFileNumber: x.identity.fileNumber, dependencies: x.dependencies, consume: (chunk, streamContext) => sanitizer.consume(chunk, streamContext) }).catch(error => sanitizerCode(error) ? mapSanitizer(error) : mapTransport(error));
  const sanitized = (() => { try { return sanitizer.finalize(context); } catch (error) { return mapSanitizer(error); } })();
  if (upstream.upstreamBodySha256 !== sanitized.upstreamEntitySha256 || upstream.bytes !== sanitized.rawByteSize) fail("FEC_SANITIZED_ACQUISITION_RECEIPT");
  const canonical = encodeFecSanitizedFilingArtifact(sanitized.artifact, context), artifactSha256 = createHash("sha256").update(canonical).digest("hex");
  return Object.freeze({ artifact: Object.freeze({ ...sanitized.artifact, records: Object.freeze(sanitized.artifact.records.map(record => Object.freeze({ ...record }))), noRetention: Object.freeze({ ...sanitized.artifact.noRetention }) }), artifactSha256, artifactByteSize: canonical.byteLength, upstreamProvenance: Object.freeze({ requestSha256: upstream.requestSha256, upstreamBodySha256: upstream.upstreamBodySha256, bytes: upstream.bytes, retrievedAt: upstream.retrievedAt }) });
}
async function core(input: FecSanitizedFilingAcquisitionOptions | FecSanitizedFilingAcquisitionTestingOptions, testing: boolean): Promise<FecSanitizedFilingAcquisitionResult> {
  try {
    const x = snapshot(input, testing);
    if (x.signal.aborted) fail("FEC_SANITIZED_ACQUISITION_ABORTED");
    if (Date.now() >= x.deadlineMs) fail("FEC_SANITIZED_ACQUISITION_DEADLINE");
    try { x.store.assertActivated(x.activation, { signal: x.signal, deadlineMs: x.deadlineMs }); } catch { fail("FEC_SANITIZED_ACQUISITION_ACTIVATION"); }
    const got = await sanitize(x);
    try {
      const receipt = await x.store.putCanonical({ activation: x.activation, planSha256: x.planSha256, artifactKind: "sanitized_filing", canonicalBytes: encodeFecSanitizedFilingArtifact(got.artifact), expectedSha256: got.artifactSha256, signal: x.signal, deadlineMs: x.deadlineMs, expectedContext: { kind: "sanitized_filing", fileNumber: x.identity.fileNumber, ledgerIdentitySha256: x.ledgerIdentitySha256 } });
      return Object.freeze({ ...got, receipt: Object.freeze({ ...receipt }) });
    } catch { fail("FEC_SANITIZED_ACQUISITION_STORE"); }
  } catch (error) {
    if (error instanceof FecSanitizedFilingAcquisitionError) throw error;
    return fail("FEC_SANITIZED_ACQUISITION_INPUT");
  }
  return fail("FEC_SANITIZED_ACQUISITION_INPUT");
}
export const acquireAndStoreFecV2SanitizedFiling = (options: FecSanitizedFilingAcquisitionOptions) => core(options, false);
export const acquireAndStoreFecV2SanitizedFilingForTesting = (options: FecSanitizedFilingAcquisitionTestingOptions) => { if (process.env.NODE_ENV === "production") fail("FEC_SANITIZED_ACQUISITION_INPUT"); return core(options, true); };
export async function acquireCanonicalFecV2SanitizedFilingForLocalResearch(input: FecLocalResearchSanitizedFilingOptions): Promise<FecLocalResearchSanitizedFilingResult> {
  if (process.env.NODE_ENV === "production") return fail("FEC_SANITIZED_ACQUISITION_INPUT");
  try {
    const { planSha256, ledgerIdentitySha256, identity, layout, budget, fecUrl, signal, deadlineMs } = input;
    if (input === null || typeof input !== "object" || Object.getPrototypeOf(input) !== Object.prototype || !SHA.test(planSha256) || !SHA.test(ledgerIdentitySha256) || !(signal instanceof AbortSignal) || !Number.isFinite(deadlineMs) || !(budget instanceof FecV2RunBudget) || budget.signal !== signal || budget.deadline !== deadlineMs || typeof fecUrl !== "string") return fail("FEC_SANITIZED_ACQUISITION_INPUT");
    const detached = decodeFecFilingIdentityV1(encodeFecFilingIdentityV1(identity)); if (fecFilingIdentitySha256(detached) !== ledgerIdentitySha256) return fail("FEC_SANITIZED_ACQUISITION_INPUT");
    if (detached.electronicStatus === "paper") return fail("FEC_SANITIZED_ACQUISITION_UNAVAILABLE", "paper_filing_unreviewed"); if (detached.rawAvailability !== "available") return fail("FEC_SANITIZED_ACQUISITION_UNAVAILABLE", "source_unavailable"); if (signal.aborted) return fail("FEC_SANITIZED_ACQUISITION_ABORTED"); if (Date.now() >= deadlineMs) return fail("FEC_SANITIZED_ACQUISITION_DEADLINE");
    return await sanitize({ planSha256, ledgerIdentitySha256, identity: detached, layout, budget, fecUrl, signal, deadlineMs, streamer: input.streamer ?? streamFecDocqueryFiling, dependencies: input.dependencies, sanitizerLimits: input.sanitizerLimits });
  } catch (error) { if (error instanceof FecSanitizedFilingAcquisitionError) throw error; return fail("FEC_SANITIZED_ACQUISITION_INPUT"); }
}
