import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "../fec/aipac-proposed-packages";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.iso.date();
const dateTime = z.iso.datetime({ offset: true });
const bytewise = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const release = z.strictObject({ id: z.literal("rel_full_20260804_v2"), label: z.string().min(1), status: z.literal("published"), sourceCutoff: z.literal("2026-08-04"), publishedAt: dateTime });
const manifest = z.strictObject({ schemaVersion: z.literal(2), canonicalDataChecksumSha256: sha256, geometryChecksumSha256: sha256, contentChecksumSha256: sha256 });
const snapshot = z.strictObject({ id: z.literal("snap_full_legislators"), sourceId: z.literal("src_full_legislators"), sourceUrl: z.literal("https://unitedstates.github.io/congress-legislators/legislators-current.json"), checksumSha256: z.literal("bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf"), parserVersion: z.literal("congress-legislators-json-v1"), license: z.literal("CC0-1.0"), usageStatus: z.literal("approved"), retrievedAt: z.literal("2026-08-04T18:20:00.000Z") });

export const dsaTargetIncumbentRosterSchema = z.strictObject({
  schema: z.literal("dsa-target-incumbent-roster-v1"), version: z.literal(1), generatedAt: dateTime, release,
  universe: z.strictObject({ definition: z.literal("occupied regular Democratic voting U.S. House seats"), expected: z.literal(212), observed: z.literal(212) }),
  productionReleaseClosure: z.strictObject({ manifest, snapshot, closureSha256: sha256 }),
  rows: z.array(z.strictObject({ seatCycleId: z.string().min(1), bioguideId: z.string().regex(/^[A-Z]\d{6}$/) })).length(212), rosterSha256: sha256,
});
export type DsaTargetIncumbentRoster = z.infer<typeof dsaTargetIncumbentRosterSchema>;

const sourceTerm = z.strictObject({ start: date, end: date, stateCode: z.string().length(2), district: z.union([z.number().int().nonnegative(), z.string().min(1)]), party: z.string().min(1) });
const breakPeriod = z.strictObject({ previousEnd: date, nextStart: date, days: z.number().int().positive() });
const tenureFact = z.strictObject({
  seatCycleId: z.string().min(1), bioguideId: z.string().regex(/^[A-Z]\d{6}$/), firstHouseServiceDate: date, currentUninterruptedHouseServiceDate: date,
  cumulativeHouseServiceDays: z.number().int().nonnegative(), cumulativeHouseServiceYears: z.number().nonnegative(), elapsedYearsSinceFirstHouseService: z.number().nonnegative(), currentUninterruptedHouseServiceYears: z.number().nonnegative(),
  materialServiceBreaks: z.array(breakPeriod), districtChangeCount: z.number().int().nonnegative(), sourceTerms: z.array(sourceTerm).min(1),
  selectedEvaluatorValue: z.strictObject({ value: z.number().min(0).max(100), observedAt: z.literal("2026-08-04"), methodologyVersion: z.literal("cumulative-recorded-house-service-days-v1"), inputSnapshotIds: z.tuple([z.literal("snap_full_legislators")]), status: z.literal("derived_candidate") }),
  factSha256: sha256,
});

export const incumbentTenureFactualCandidateSchema = z.strictObject({
  schema: z.literal("incumbent-tenure-factual-candidate-v1"), version: z.literal(1), generatedAt: z.literal("2026-08-04T18:20:00.000Z"), sourceCutoff: z.literal("2026-08-04"), reviewerOnly: z.literal(true), publicationEligible: z.literal(false),
  review: z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() }),
  inputs: z.strictObject({
    sourceLockId: z.literal("congress-legislators-current-20260804"), sourceFileSha256: z.literal("bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf"), sourceRecords: z.literal(537),
    rosterSourceLockId: z.literal("dsa-target-incumbent-roster-20260804-v1"), rosterFileSha256: sha256, rosterSha256: sha256, productionSnapshotId: z.literal("snap_full_legislators"), productionSnapshotSha256: z.literal("bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf"),
  }),
  methodology: z.strictObject({ selectedMetric: z.literal("cumulative_recorded_house_service"), intervalModel: z.literal("source_start_inclusive_end_exclusive_cutoff_day_inclusive"), cutoffExclusive: z.literal("2026-08-05"), yearDays: z.literal(365.2425), includedTermType: z.literal("rep"), senateTermsExcluded: z.literal(true), serviceBreaksExcludedFromCumulativeValue: z.literal(true), districtChangesFollowBioguideIdentity: z.literal(true), uninterruptedContinuityToleranceDays: z.literal(7), materialBreakThresholdDays: z.literal(30) }),
  summary: z.strictObject({ seats: z.literal(212), sourceHouseTerms: z.literal(1251), values: z.literal(212), missing: z.literal(0), materiallyInterruptedCareers: z.literal(9), districtChangedCareers: z.literal(50), priorDelegateCareers: z.literal(0), decisions: z.literal(1) }),
  facts: z.array(tenureFact).length(212),
  decision: z.strictObject({ decisionId: z.literal("approve-cumulative-recorded-house-service-methodology-v1"), question: z.string().min(1), recommendedDecision: z.string().min(1), defaultReversibleAssumption: z.literal("use_in_reviewer_only_evaluation_exclude_from_publication"), alternatives: z.array(z.string().min(1)).min(2), consequences: z.array(z.string().min(1)).min(2), confidence: z.literal("high"), blocksPublication: z.literal(true), blocksOtherWork: z.literal(false), resolution: z.null() }),
  packageSha256: sha256,
});
export type IncumbentTenureFactualCandidate = z.infer<typeof incumbentTenureFactualCandidateSchema>;

type Legislator = { id?: { bioguide?: unknown }; terms?: unknown };
type HouseTerm = { type?: unknown; start?: unknown; end?: unknown; state?: unknown; district?: unknown; party?: unknown };
const DAY = 86_400_000; const YEAR_DAYS = 365.2425; const CUTOFF = "2026-08-04" as const; const CUTOFF_EXCLUSIVE = "2026-08-05";
const NONVOTING_DELEGATE_JURISDICTIONS = new Set(["AS", "DC", "GU", "MP", "PR", "VI"]);
const milliseconds = (value: string): number => Date.parse(`${value}T00:00:00Z`);
const days = (start: string, end: string): number => (milliseconds(end) - milliseconds(start)) / DAY;
const rounded = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

export function validateDsaTargetIncumbentRoster(value: unknown): DsaTargetIncumbentRoster {
  const parsed = dsaTargetIncumbentRosterSchema.parse(value); const { rosterSha256, ...unsigned } = parsed;
  if (rosterSha256 !== hash("dsa-seats:dsa-target-incumbent-roster:v1\0", unsigned)) throw new Error("DSA_TARGET_ROSTER_HASH_MISMATCH");
  const expectedClosure = hash("dsa-seats:production-incumbent-roster-closure:v1\0", { release: parsed.release, manifest: parsed.productionReleaseClosure.manifest, snapshot: parsed.productionReleaseClosure.snapshot });
  if (parsed.productionReleaseClosure.closureSha256 !== expectedClosure || new Set(parsed.rows.map((row) => row.seatCycleId)).size !== 212 || new Set(parsed.rows.map((row) => row.bioguideId)).size !== 212) throw new Error("DSA_TARGET_ROSTER_CLOSURE_INVALID");
  return parsed;
}

function termsFor(person: Legislator, bioguideId: string): z.infer<typeof sourceTerm>[] {
  if (!Array.isArray(person.terms)) throw new Error(`INCUMBENT_TENURE_TERMS_MISSING:${bioguideId}`);
  const terms = (person.terms as HouseTerm[]).filter((term) => term.type === "rep" && typeof term.start === "string" && typeof term.state === "string" && !NONVOTING_DELEGATE_JURISDICTIONS.has(term.state) && term.start <= CUTOFF).map((term) => {
    const value = { start: term.start, end: term.end, stateCode: term.state, district: term.district, party: term.party };
    return sourceTerm.parse(value);
  }).sort((a, b) => bytewise(a.start, b.start));
  if (terms.length === 0 || terms.some((term, index) => term.end <= term.start || (index > 0 && term.start < terms[index - 1]!.end))) throw new Error(`INCUMBENT_TENURE_INTERVAL_INVALID:${bioguideId}`);
  if (!terms.some((term) => term.start <= CUTOFF && term.end > CUTOFF)) throw new Error(`INCUMBENT_TENURE_CURRENT_TERM_MISSING:${bioguideId}`);
  return terms;
}

function factFor(row: DsaTargetIncumbentRoster["rows"][number], person: Legislator): z.input<typeof tenureFact> {
  const terms = termsFor(person, row.bioguideId); const effective = terms.map((term) => ({ ...term, effectiveEnd: term.end < CUTOFF_EXCLUSIVE ? term.end : CUTOFF_EXCLUSIVE }));
  const cumulativeDays = effective.reduce((sum, term) => sum + days(term.start, term.effectiveEnd), 0);
  const breaks = terms.slice(1).map((term, index) => ({ previousEnd: terms[index]!.end, nextStart: term.start, days: days(terms[index]!.end, term.start) })).filter((gap) => gap.days > 30);
  let uninterruptedStart = terms.at(-1)!.start;
  for (let index = terms.length - 2; index >= 0; index -= 1) { if (days(terms[index]!.end, uninterruptedStart) <= 7) uninterruptedStart = terms[index]!.start; else break; }
  const transitions = terms.slice(1).filter((term, index) => term.stateCode !== terms[index]!.stateCode || String(term.district) !== String(terms[index]!.district)).length;
  const unsigned = {
    seatCycleId: row.seatCycleId, bioguideId: row.bioguideId, firstHouseServiceDate: terms[0]!.start, currentUninterruptedHouseServiceDate: uninterruptedStart,
    cumulativeHouseServiceDays: cumulativeDays, cumulativeHouseServiceYears: rounded(cumulativeDays / YEAR_DAYS), elapsedYearsSinceFirstHouseService: rounded(days(terms[0]!.start, CUTOFF_EXCLUSIVE) / YEAR_DAYS), currentUninterruptedHouseServiceYears: rounded(days(uninterruptedStart, CUTOFF_EXCLUSIVE) / YEAR_DAYS),
    materialServiceBreaks: breaks, districtChangeCount: transitions, sourceTerms: terms,
    selectedEvaluatorValue: { value: rounded(cumulativeDays / YEAR_DAYS), observedAt: CUTOFF, methodologyVersion: "cumulative-recorded-house-service-days-v1" as const, inputSnapshotIds: ["snap_full_legislators"] as ["snap_full_legislators"], status: "derived_candidate" as const },
  };
  return { ...unsigned, factSha256: hash("dsa-seats:incumbent-tenure-fact:v1\0", unsigned) };
}

export function buildIncumbentTenureFactualCandidate(input: Readonly<{ roster: unknown; rosterFileSha256: string; legislators: unknown }>): IncumbentTenureFactualCandidate {
  const roster = validateDsaTargetIncumbentRoster(input.roster);
  if (!sha256.safeParse(input.rosterFileSha256).success || !Array.isArray(input.legislators) || input.legislators.length !== 537) throw new Error("INCUMBENT_TENURE_INPUT_CLOSURE_INVALID");
  const byBioguide = new Map<string, Legislator>();
  for (const person of input.legislators as Legislator[]) { const id = person.id?.bioguide; if (typeof id !== "string" || byBioguide.has(id)) throw new Error("INCUMBENT_TENURE_SOURCE_ID_INVALID"); byBioguide.set(id, person); }
  const facts = roster.rows.map((row) => { const person = byBioguide.get(row.bioguideId); if (!person) throw new Error(`INCUMBENT_TENURE_PERSON_MISSING:${row.bioguideId}`); return factFor(row, person); });
  const summary = { seats: 212 as const, sourceHouseTerms: facts.reduce((sum, fact) => sum + fact.sourceTerms.length, 0), values: 212 as const, missing: 0 as const, materiallyInterruptedCareers: facts.filter((fact) => fact.materialServiceBreaks.length > 0).length, districtChangedCareers: facts.filter((fact) => fact.districtChangeCount > 0).length, priorDelegateCareers: facts.filter((fact) => fact.sourceTerms.some((term) => ["AS", "DC", "GU", "MP", "PR", "VI"].includes(term.stateCode))).length, decisions: 1 as const };
  const unsigned = {
    schema: "incumbent-tenure-factual-candidate-v1" as const, version: 1 as const, generatedAt: "2026-08-04T18:20:00.000Z" as const, sourceCutoff: CUTOFF as "2026-08-04", reviewerOnly: true as const, publicationEligible: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null },
    inputs: { sourceLockId: "congress-legislators-current-20260804" as const, sourceFileSha256: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf" as const, sourceRecords: 537 as const, rosterSourceLockId: "dsa-target-incumbent-roster-20260804-v1" as const, rosterFileSha256: input.rosterFileSha256, rosterSha256: roster.rosterSha256, productionSnapshotId: "snap_full_legislators" as const, productionSnapshotSha256: "bc48cccd12df96164e5a2415fc41e838ca255fe85c297731515529692f7982cf" as const },
    methodology: { selectedMetric: "cumulative_recorded_house_service" as const, intervalModel: "source_start_inclusive_end_exclusive_cutoff_day_inclusive" as const, cutoffExclusive: CUTOFF_EXCLUSIVE as "2026-08-05", yearDays: YEAR_DAYS as 365.2425, includedTermType: "rep" as const, senateTermsExcluded: true as const, serviceBreaksExcludedFromCumulativeValue: true as const, districtChangesFollowBioguideIdentity: true as const, uninterruptedContinuityToleranceDays: 7 as const, materialBreakThresholdDays: 30 as const }, summary, facts,
    decision: { decisionId: "approve-cumulative-recorded-house-service-methodology-v1" as const, question: "Should cumulative recorded House service days divided by 365.2425 be accepted as the evaluator's incumbent-tenure factor?", recommendedDecision: "accept because the metric counts only source-recorded House service intervals, excludes all time out of office, follows stable BioGuide identity across district changes, and preserves alternative dates for audit", defaultReversibleAssumption: "use_in_reviewer_only_evaluation_exclude_from_publication" as const, alternatives: ["use current uninterrupted House service instead", "use elapsed years since first House service", "keep tenure missing"], consequences: ["The recommended metric prevents nine interrupted careers from being inflated by time out of office.", "A different choice changes feasibility scores and rank order but not the raw term facts."], confidence: "high" as const, blocksPublication: true as const, blocksOtherWork: false as const, resolution: null },
  };
  return incumbentTenureFactualCandidateSchema.parse({ ...unsigned, packageSha256: hash("dsa-seats:incumbent-tenure-factual-candidate:v1\0", unsigned) });
}

export function validateIncumbentTenureFactualCandidate(value: unknown): IncumbentTenureFactualCandidate {
  const parsed = incumbentTenureFactualCandidateSchema.parse(value); const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== hash("dsa-seats:incumbent-tenure-factual-candidate:v1\0", unsigned)) throw new Error("INCUMBENT_TENURE_PACKAGE_HASH_MISMATCH");
  const invalidFact = parsed.facts.some((fact) => {
    const terms = fact.sourceTerms;
    const intervalInvalid = terms.some((term, index) => term.end <= term.start || term.start > CUTOFF || NONVOTING_DELEGATE_JURISDICTIONS.has(term.stateCode) || (index > 0 && term.start < terms[index - 1]!.end));
    const cumulativeDays = terms.reduce((sum, term) => sum + days(term.start, term.end < CUTOFF_EXCLUSIVE ? term.end : CUTOFF_EXCLUSIVE), 0);
    const materialBreaks = terms.slice(1).map((term, index) => ({ previousEnd: terms[index]!.end, nextStart: term.start, days: days(terms[index]!.end, term.start) })).filter((gap) => gap.days > 30);
    let uninterruptedStart = terms.at(-1)!.start;
    for (let index = terms.length - 2; index >= 0; index -= 1) { if (days(terms[index]!.end, uninterruptedStart) <= 7) uninterruptedStart = terms[index]!.start; else break; }
    const districtChanges = terms.slice(1).filter((term, index) => term.stateCode !== terms[index]!.stateCode || String(term.district) !== String(terms[index]!.district)).length;
    const { factSha256, ...factUnsigned } = fact;
    return intervalInvalid
      || !terms.some((term) => term.start <= CUTOFF && term.end > CUTOFF)
      || factSha256 !== hash("dsa-seats:incumbent-tenure-fact:v1\0", factUnsigned)
      || fact.firstHouseServiceDate !== terms[0]!.start
      || fact.currentUninterruptedHouseServiceDate !== uninterruptedStart
      || fact.cumulativeHouseServiceDays !== cumulativeDays
      || fact.cumulativeHouseServiceYears !== rounded(cumulativeDays / YEAR_DAYS)
      || fact.elapsedYearsSinceFirstHouseService !== rounded(days(terms[0]!.start, CUTOFF_EXCLUSIVE) / YEAR_DAYS)
      || fact.currentUninterruptedHouseServiceYears !== rounded(days(uninterruptedStart, CUTOFF_EXCLUSIVE) / YEAR_DAYS)
      || canonicalJson(fact.materialServiceBreaks) !== canonicalJson(materialBreaks)
      || fact.districtChangeCount !== districtChanges
      || fact.selectedEvaluatorValue.value !== fact.cumulativeHouseServiceYears;
  });
  const summary = { seats: parsed.facts.length, sourceHouseTerms: parsed.facts.reduce((sum, fact) => sum + fact.sourceTerms.length, 0), values: parsed.facts.length, missing: 0, materiallyInterruptedCareers: parsed.facts.filter((fact) => fact.materialServiceBreaks.length > 0).length, districtChangedCareers: parsed.facts.filter((fact) => fact.districtChangeCount > 0).length, priorDelegateCareers: parsed.facts.filter((fact) => fact.sourceTerms.some((term) => NONVOTING_DELEGATE_JURISDICTIONS.has(term.stateCode))).length, decisions: 1 };
  if (new Set(parsed.facts.map((fact) => fact.seatCycleId)).size !== 212 || new Set(parsed.facts.map((fact) => fact.bioguideId)).size !== 212 || canonicalJson(parsed.summary) !== canonicalJson(summary) || invalidFact) throw new Error("INCUMBENT_TENURE_FACT_CLOSURE_INVALID");
  return parsed;
}
