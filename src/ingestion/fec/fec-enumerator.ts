import { createHash } from "node:crypto";
import { deriveFecEnumerationPartitions, encodeFecAcquisitionPlan, fecAcquisitionPlanSha256, type FecAcquisitionPlanV2, type FecEnumerationPartition } from "./acquisition-plan";
import { fetchOpenFecFilingsPage, fetchOpenFecPredecessorPair, FecV2TransportError, type FecV2Dependencies, type FecV2Evidence, type FecV2FecUrl, type FecV2OpenFecPage, FecV2RunBudget } from "./fetch-client-v2";
import { encodeFecEnumerationPage, encodeFecFilingIdentityV1, encodeFecFilingLedger, fecFilingIdentitySha256, fecFilingLedgerSha256, fecPageComparisonDigestSha256, fecPassMultiplicityDigestSha256, type FecEnumerationPageV1, type FecFilingIdentityV1, type FecFilingLedgerV1, type FecFormType, type FecMultiplicity, type FecPass } from "./filing-ledger";

export const FEC_V2_ENUMERATION_ERRORS = ["FEC_V2_ENUMERATION_INVALID", "FEC_V2_ENUMERATION_UNSTABLE", "FEC_V2_ENUMERATION_PAGE_LIMIT", "FEC_V2_ENUMERATION_CHAIN", "FEC_V2_ENUMERATION_LOOKUP", "FEC_V2_ENUMERATION_ABORTED", "FEC_V2_ENUMERATION_DEADLINE"] as const;
export type FecV2EnumerationErrorCode = typeof FEC_V2_ENUMERATION_ERRORS[number];
export class FecV2EnumerationError extends Error { constructor(readonly code: FecV2EnumerationErrorCode) { super(code); this.name = "FecV2EnumerationError"; } }
const fail = (code: FecV2EnumerationErrorCode): never => { throw new FecV2EnumerationError(code); };
const order = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const MAX_ENTRIES = 2_000_000, MAX_LEDGER_BYTES = 64 * 1024 * 1024;

export type FecPageLineageTuple = Readonly<{ fileNumber: number; pageSha256: string; pass: FecPass; occurrenceIndex: number }>;
export type FecPageArtifact = Readonly<{ page: FecEnumerationPageV1; bytes: Uint8Array; artifactSha256: string; upstreamReceipt: FecV2OpenFecPage["receipt"]; lineage: readonly FecPageLineageTuple[] }>;
/** Compact metadata only; page objects and artifact bytes are never retained. */
export type FecPageRef = Readonly<{ artifactSha256: string; upstreamBodySha256: string; bytes: number }>;
export type FecEnumeratorResult = Readonly<{ pageRefs: readonly FecPageRef[]; ledger: FecFilingLedgerV1; ledgerBytes: Uint8Array; ledgerSha256: string; fecUrlsByFileNumber: readonly (readonly [number, FecV2FecUrl | null])[]; counts: Readonly<{ partitions: number; pages: number; entries: number; occurrences: number }> }>;
export type FecEnumeratorOptions = Readonly<{ plan: FecAcquisitionPlanV2; planSha256: string; budget: FecV2RunBudget; apiKey: string; dependencies?: FecV2Dependencies; sinkPage: (artifact: FecPageArtifact, context: Readonly<{ signal: AbortSignal; deadlineMs: number }>) => void | Promise<void> }>;

export function enumerateFecPartitions(options: Readonly<{ plan: FecAcquisitionPlanV2 }>): readonly FecEnumerationPartition[] { return deriveFecEnumerationPartitions(options.plan); }
const sameIdentity = (a: FecFilingIdentityV1, b: FecFilingIdentityV1) => Buffer.from(encodeFecFilingIdentityV1(a)).equals(Buffer.from(encodeFecFilingIdentityV1(b)));
const mapTransport = (error: unknown, area: "daily" | "lookup" | "admission"): FecV2EnumerationErrorCode => {
  if (error instanceof FecV2EnumerationError) return error.code;
  if (error instanceof FecV2TransportError) {
    if (error.code === "FEC_V2_ABORTED") return "FEC_V2_ENUMERATION_ABORTED";
    if (error.code === "FEC_V2_DEADLINE" || error.code === "FEC_V2_TIMEOUT") return "FEC_V2_ENUMERATION_DEADLINE";
    if (error.code === "FEC_V2_BUDGET") return "FEC_V2_ENUMERATION_PAGE_LIMIT";
  }
  return area === "lookup" ? "FEC_V2_ENUMERATION_LOOKUP" : "FEC_V2_ENUMERATION_INVALID";
};
const mapLocal = (error: unknown): FecV2EnumerationErrorCode => {
  if (error instanceof FecV2EnumerationError) return error.code;
  if (error instanceof Error && error.message.startsWith("FEC_LEDGER_")) {
    if (error.message === "FEC_LEDGER_ABORTED") return "FEC_V2_ENUMERATION_ABORTED";
    if (error.message === "FEC_LEDGER_DEADLINE") return "FEC_V2_ENUMERATION_DEADLINE";
    if (error.message === "FEC_LEDGER_INPUT_TOO_LARGE") return "FEC_V2_ENUMERATION_PAGE_LIMIT";
  }
  return "FEC_V2_ENUMERATION_INVALID";
};
const check = (budget: FecV2RunBudget) => { try { budget.assertLive(); } catch (e) { fail(mapTransport(e, "daily")); } };
const cloneIdentity = (identity: FecFilingIdentityV1): FecFilingIdentityV1 => ({ ...identity, authoritativeAmendmentChain: [...identity.authoritativeAmendmentChain] });
const cloneArtifact = (artifact: FecPageArtifact): FecPageArtifact => ({ page: { ...artifact.page, provenance: { ...artifact.page.provenance }, records: artifact.page.records.map(r => ({ occurrenceIndex: r.occurrenceIndex, identity: cloneIdentity(r.identity) })), recordMultiplicity: artifact.page.recordMultiplicity.map(x => ({ ...x })) }, bytes: artifact.bytes.slice(), artifactSha256: artifact.artifactSha256, upstreamReceipt: { ...artifact.upstreamReceipt }, lineage: artifact.lineage.map(x => ({ ...x })) });
async function sinkWithinBudget(sink: FecEnumeratorOptions["sinkPage"], artifact: FecPageArtifact, budget: FecV2RunBudget): Promise<void> {
  check(budget); const deadline = budget.deadline, now = budget.now(); if (now >= deadline) fail("FEC_V2_ENUMERATION_DEADLINE");
  await new Promise<void>((resolve, reject) => {
    let settled = false; const done = (fn: () => void) => { if (!settled) { settled = true; clearTimeout(timer); budget.signal.removeEventListener("abort", abort); fn(); } };
    const abort = () => done(() => reject(new FecV2EnumerationError("FEC_V2_ENUMERATION_ABORTED")));
    const timeout = () => done(() => reject(new FecV2EnumerationError("FEC_V2_ENUMERATION_DEADLINE")));
    const timer = setTimeout(timeout, Math.max(0, deadline - now)); budget.signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => sink(cloneArtifact(artifact), { signal: budget.signal, deadlineMs: deadline })).then(() => done(resolve), () => done(() => reject(new FecV2EnumerationError(budget.signal.aborted ? "FEC_V2_ENUMERATION_ABORTED" : budget.now() >= deadline ? "FEC_V2_ENUMERATION_DEADLINE" : "FEC_V2_ENUMERATION_INVALID"))));
  }); check(budget);
}

async function enumerateNationwideFecFilingsInner(options: FecEnumeratorOptions): Promise<FecEnumeratorResult> {
  const { plan, planSha256, budget } = options; check(budget);
  try { if (!/^[a-f0-9]{64}$/.test(planSha256) || planSha256 !== fecAcquisitionPlanSha256(encodeFecAcquisitionPlan(plan))) fail("FEC_V2_ENUMERATION_INVALID"); } catch (e) { if (e instanceof FecV2EnumerationError) throw e; fail("FEC_V2_ENUMERATION_INVALID"); }
  const partitions = enumerateFecPartitions({ plan }); if (partitions.length !== 2256) fail("FEC_V2_ENUMERATION_INVALID");
  try { budget.assertCanAdmit("openfec", 4512); } catch (e) { fail(mapTransport(e, "admission")); }
  const identities = new Map<number, FecFilingIdentityV1>(), urls = new Map<number, FecV2FecUrl | null>(), passCounts: Record<FecPass, Map<string, number>> = { 1: new Map(), 2: new Map() }, pass1Pages = new Map<string, string>();
  const sourcePages = new Set<string>(), refs: FecPageRef[] = []; let pages = 0, occurrences = 0, ledgerEstimate = 300;
  const admit = (filing: FecV2OpenFecPage["records"][number]) => { const old = identities.get(filing.identity.fileNumber), oldUrl = urls.get(filing.identity.fileNumber); if (old && !sameIdentity(old, filing.identity) || oldUrl !== undefined && oldUrl !== filing.fecUrl) fail("FEC_V2_ENUMERATION_UNSTABLE"); if (!old) { if (identities.size >= MAX_ENTRIES) fail("FEC_V2_ENUMERATION_PAGE_LIMIT"); ledgerEstimate += encodeFecFilingIdentityV1(filing.identity).byteLength + 100; if (ledgerEstimate > MAX_LEDGER_BYTES) fail("FEC_V2_ENUMERATION_PAGE_LIMIT"); identities.set(filing.identity.fileNumber, cloneIdentity(filing.identity)); urls.set(filing.identity.fileNumber, filing.fecUrl); } };
  const persist = async (got: FecV2OpenFecPage, provenance: FecEnumerationPageV1["provenance"], pass: FecPass, pageNumber: number) => {
    check(budget); const records = got.records.map((r, i) => ({ identity: cloneIdentity(r.identity), occurrenceIndex: i + 1 })); const counts = new Map<string, number>(); const comparisonRecords: { occurrenceIndex: number; identityHash: string; fecUrl: string | null }[] = [];
    for (const [i, r] of got.records.entries()) { const hash = fecFilingIdentitySha256(r.identity, { signal: budget.signal, deadlineMs: budget.deadline }); counts.set(hash, (counts.get(hash) ?? 0) + 1); comparisonRecords.push({ occurrenceIndex: i + 1, identityHash: hash, fecUrl: r.fecUrl }); }
    const recordMultiplicity: FecMultiplicity[] = [...counts].sort(([a], [b]) => order(a, b)).map(([entryIdentitySha256, count]) => ({ entryIdentitySha256, count })); const page: FecEnumerationPageV1 = { schema: "fec-v2-enumeration-page-v1", version: 1, planSha256, provenance: { ...provenance }, pass, pageNumber, terminal: !records.length, records, recordMultiplicity };
    const bytes = encodeFecEnumerationPage(page, { signal: budget.signal, deadlineMs: budget.deadline }), artifactSha256 = createHash("sha256").update(bytes).digest("hex"); const lineage = records.map(r => ({ fileNumber: r.identity.fileNumber, pageSha256: artifactSha256, pass, occurrenceIndex: r.occurrenceIndex }));
    if (!sourcePages.has(artifactSha256)) { if (ledgerEstimate + 67 > MAX_LEDGER_BYTES) fail("FEC_V2_ENUMERATION_PAGE_LIMIT"); ledgerEstimate += 67; }
    // Sink-before-instability writes are transient Task7 cleanup artifacts; canonical local validation completes first.
    await sinkWithinBudget(options.sinkPage, { page, bytes, artifactSha256, upstreamReceipt: { ...got.receipt }, lineage }, budget);
    const key = JSON.stringify([provenance, pageNumber]), digest = fecPageComparisonDigestSha256({ provenance, pageNumber, terminal: page.terminal, records: comparisonRecords, multiplicity: recordMultiplicity }); if (pass === 1) pass1Pages.set(key, digest); else if (pass1Pages.get(key) !== digest) fail("FEC_V2_ENUMERATION_UNSTABLE"); else pass1Pages.delete(key);
    pages++; sourcePages.add(artifactSha256); refs.push({ artifactSha256, upstreamBodySha256: got.receipt.upstreamBodySha256, bytes: got.receipt.bytes }); for (const [hash, count] of counts) passCounts[pass].set(hash, (passCounts[pass].get(hash) ?? 0) + count); for (const filing of got.records) admit(filing); if (pass === 1) occurrences += got.records.length; return page.terminal;
  };
  for (const pass of [1, 2] as const) for (const partition of partitions) { const evidence: FecV2Evidence = { kind: "daily_partition", formType: partition.formType, receiptDate: partition.receiptDate }; for (let n = 1; n <= 1000; n++) { check(budget); let got: FecV2OpenFecPage; try { got = await fetchOpenFecFilingsPage({ budget, apiKey: options.apiKey, evidence, page: n, dependencies: options.dependencies }); } catch (e) { fail(mapTransport(e, "daily")); } if (await persist(got!, evidence, pass, n)) break; if (n === 1000) fail("FEC_V2_ENUMERATION_PAGE_LIMIT"); } }
  const required = new Map<number, FecFormType>(); for (const id of identities.values()) for (const file of id.authoritativeAmendmentChain) if (!identities.has(file)) required.set(file, id.canonicalFormType); const looked = new Set<number>();
  while (required.size) { if (looked.size >= 10_000) fail("FEC_V2_ENUMERATION_LOOKUP"); const [file, form] = [...required].sort(([a], [b]) => a - b)[0]!; required.delete(file); if (identities.has(file)) continue; looked.add(file); const evidence = { kind: "predecessor_lookup" as const, formType: form, requestedFileNumber: file }; let pair; try { pair = await fetchOpenFecPredecessorPair({ budget, apiKey: options.apiKey, evidence, dependencies: options.dependencies }); } catch (e) { fail(mapTransport(e, "lookup")); } for (const [pass, pp] of [[1, pair!.pass1], [2, pair!.pass2]] as const) { if (pp.page1.records.length !== 1 || pp.page2.records.length) fail("FEC_V2_ENUMERATION_LOOKUP"); await persist(pp.page1, evidence, pass, 1); await persist(pp.page2, evidence, pass, 2); } const found = identities.get(file)!; if (found.receiptDate >= plan.enumerationLowerBound || found.canonicalFormType !== form) fail("FEC_V2_ENUMERATION_CHAIN"); for (const ancestor of found.authoritativeAmendmentChain) if (!identities.has(ancestor)) required.set(ancestor, found.canonicalFormType); }
  if (pass1Pages.size) fail("FEC_V2_ENUMERATION_UNSTABLE"); const digest1 = fecPassMultiplicityDigestSha256(passCounts[1], { signal: budget.signal, deadlineMs: budget.deadline }), digest2 = fecPassMultiplicityDigestSha256(passCounts[2], { signal: budget.signal, deadlineMs: budget.deadline }); if (digest1 !== digest2) fail("FEC_V2_ENUMERATION_UNSTABLE");
  const successors = new Map<number, number>();
  for (const id of identities.values()) { const chain = id.authoritativeAmendmentChain; if (chain.length > 100 || chain.at(-1) !== id.fileNumber || id.previousFileNumber !== (chain.length === 1 ? null : chain.at(-2)!)) fail("FEC_V2_ENUMERATION_CHAIN"); if (id.previousFileNumber !== null) { const successor = successors.get(id.previousFileNumber); if (successor !== undefined && successor !== id.fileNumber) fail("FEC_V2_ENUMERATION_CHAIN"); successors.set(id.previousFileNumber, id.fileNumber); } for (let i = 0; i < chain.length; i++) { const node = identities.get(chain[i]!); if (!node || node.authoritativeAmendmentChain.length !== i + 1 || node.authoritativeAmendmentChain.some((n, j) => n !== chain[j]) || node.previousFileNumber !== (i ? chain[i - 1]! : null)) fail("FEC_V2_ENUMERATION_CHAIN"); } }
  const entries = [...identities.values()].map(identity => ({ identity, entryIdentitySha256: fecFilingIdentitySha256(identity, { signal: budget.signal, deadlineMs: budget.deadline }) })).sort((a, b) => a.identity.fileNumber - b.identity.fileNumber); const ledger: FecFilingLedgerV1 = { schema: "fec-v2-filing-ledger-v1", version: 1, planSha256, entries, sourcePageIdentities: [...sourcePages].sort(order), pass1DigestSha256: digest1, pass2DigestSha256: digest2, stable: true }; const ledgerBytes = encodeFecFilingLedger(ledger, { signal: budget.signal, deadlineMs: budget.deadline });
  return { pageRefs: refs, ledger, ledgerBytes, ledgerSha256: fecFilingLedgerSha256(ledger, { signal: budget.signal, deadlineMs: budget.deadline }), fecUrlsByFileNumber: [...urls].sort(([a], [b]) => a - b).map(([n, u]) => Object.freeze([n, u] as const)), counts: { partitions: partitions.length, pages, entries: entries.length, occurrences } };
}

/** The enumeration boundary never exposes codec, hash, or encoding implementation errors. */
export async function enumerateNationwideFecFilings(options: FecEnumeratorOptions): Promise<FecEnumeratorResult> {
  try { return await enumerateNationwideFecFilingsInner(options); } catch (error) { return fail(mapLocal(error)); }
}
