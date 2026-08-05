import { createHash } from "node:crypto";
import { z } from "zod";
import type { PresidentialDistrict } from "../../../scripts/enrich-full-factual";
import { canonicalJson } from "../fec/aipac-proposed-packages";
import { validateDsaTargetFactualProjection } from "../../domain/dsa-target-review-report";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const vote = z.number().int().nonnegative();
const review = z.strictObject({ status: z.literal("proposed"), reviewer: z.null(), reviewedAt: z.null() });
const fact = z.strictObject({
  stateCode: z.string().length(2), districtCode: z.string().min(1), bidenVotes: vote, trumpVotes: vote,
  totalVotes: vote, democraticMarginPoints: z.number().min(-100).max(100), sourceRowSha256: sha256,
});

export const presidentialCurrentBoundaryProposalSchema = z.strictObject({
  schema: z.literal("presidential-current-boundary-review-proposal-v1"), version: z.literal(1),
  generatedAt: z.literal("2026-08-04T18:20:00.000Z"), sourceCutoff: z.literal("2026-08-04"),
  publicationEligible: z.literal(false), review,
  source: z.strictObject({
    sourceLockId: z.literal("downballot-presidential-cd-2024-csv"),
    sourceUrl: z.literal("https://docs.google.com/spreadsheets/d/1ng1i_Dm_RMDnEvauH44pgE6JCUsapcuu8F2pCfeLWFo/export?format=csv&gid=1491069057"),
    fileSha256: z.literal("938410ae6b42104eb6ee73ff1fcb4de13f39c2aefa607c73b5664eec9ade974e"),
    byteSize: z.literal(55833), authority: z.literal("editorial"), licenseRecordedInProductionSnapshot: z.literal("publisher-publication"),
    productionSnapshotId: z.literal("snap_full_elections"), productionSnapshotSha256: z.literal("938410ae6b42104eb6ee73ff1fcb4de13f39c2aefa607c73b5664eec9ade974e"),
    productionSnapshotUsageStatus: z.literal("approved"), parserVersion: z.literal("downballot-cd-exact-csv-v1"),
  }),
  geometry: z.strictObject({ sourceLockId: z.literal("geo-national-cd119"), fileSha256: sha256, cdSession: z.literal("119"), votingDistrictKeys: z.literal(435), compatibilityStatus: z.literal("proposed") }),
  methodology: z.strictObject({ id: z.literal("downballot-cd-2020-current-boundary-proposal-v1"), lineageStatus: z.literal("modeled"), denominator: z.literal("all_presidential_votes"), formula: z.literal("100 * (Biden votes - Trump votes) / total votes"), geographyClaim: z.literal("publisher_calculation_for_district_lines_used_in_2024") }),
  summary: z.strictObject({ districtFacts: z.literal(435), targetSeatFacts: z.literal(212), geometryKeyMatches: z.literal(435), production2024Crosschecks: z.literal(212), production2024CrosscheckFailures: z.literal(0), decisions: z.literal(2) }),
  districtFacts: z.array(fact).length(435),
  targetSeatFacts: z.array(fact.extend({ seatCycleId: z.string().min(1) })).length(212),
  decisions: z.array(z.strictObject({
    decisionId: z.enum(["approve-current-boundary-compatibility", "approve-editorial-source-use"]), question: z.string().min(1), recommendedDecision: z.string().min(1),
    defaultReversibleAssumption: z.literal("exclude_from_scoring_and_publication"), alternatives: z.array(z.string().min(1)).min(1), consequences: z.array(z.string().min(1)).min(1),
    blocksPublication: z.literal(true), blocksOtherWork: z.literal(false), resolution: z.null(),
  })).length(2),
  packageSha256: sha256,
});
export type PresidentialCurrentBoundaryProposal = z.infer<typeof presidentialCurrentBoundaryProposalSchema>;

const hash = (domain: string, value: unknown): string => createHash("sha256").update(domain).update(canonicalJson(value)).digest("hex");
const bytewise = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
const key = (state: string, district: string): string => `${state}-${district}`;

export function buildPresidentialCurrentBoundaryProposal(input: Readonly<{
  districts: readonly PresidentialDistrict[]; projection: unknown; geometryKeys: readonly string[]; geometryFileSha256: string;
}>): PresidentialCurrentBoundaryProposal {
  const projection = validateDsaTargetFactualProjection(input.projection);
  const expectedGeometry = [...input.geometryKeys].sort(bytewise);
  if (expectedGeometry.length !== 435 || new Set(expectedGeometry).size !== 435 || !sha256.safeParse(input.geometryFileSha256).success) throw new Error("PRESIDENTIAL_2020_GEOMETRY_CLOSURE_INVALID");
  const rows = input.districts.map((row) => {
    if (row.total2020 <= 0 || row.biden2020 + row.trump2020 > row.total2020) throw new Error(`PRESIDENTIAL_2020_VOTE_INVALID:${key(row.state, row.district)}`);
    const unsigned = { stateCode: row.state, districtCode: row.district, bidenVotes: row.biden2020, trumpVotes: row.trump2020, totalVotes: row.total2020, democraticMarginPoints: ((row.biden2020 - row.trump2020) / row.total2020) * 100 };
    return { ...unsigned, sourceRowSha256: hash("dsa-seats:downballot-presidential-2020-row:v1\0", unsigned) };
  }).sort((a, b) => bytewise(key(a.stateCode, a.districtCode), key(b.stateCode, b.districtCode)));
  const rowKeys = rows.map((row) => key(row.stateCode, row.districtCode));
  if (rows.length !== 435 || new Set(rowKeys).size !== 435 || rowKeys.some((value, index) => value !== expectedGeometry[index])) throw new Error("PRESIDENTIAL_2020_DISTRICT_CLOSURE_INVALID");
  const byKey = new Map(rows.map((row) => [key(row.stateCode, row.districtCode), row]));
  const sourceByKey = new Map(input.districts.map((row) => [key(row.state, row.district), row]));
  const targetSeatFacts = projection.seats.map((seat) => {
    const districtKey = key(seat.stateCode, seat.districtCode); const row = byKey.get(districtKey); const source = sourceByKey.get(districtKey);
    if (!row || !source) throw new Error(`PRESIDENTIAL_2020_TARGET_MISSING:${seat.seatCycleId}`);
    const margin2024 = ((source.harris - source.trump) / source.total) * 100;
    if (Math.abs(margin2024 - seat.presidentialMargin2024.value) > 1e-9) throw new Error(`PRESIDENTIAL_2020_PRODUCTION_CROSSCHECK_FAILED:${seat.seatCycleId}`);
    return { ...row, seatCycleId: seat.seatCycleId };
  });
  const unsigned = {
    schema: "presidential-current-boundary-review-proposal-v1" as const, version: 1 as const, generatedAt: "2026-08-04T18:20:00.000Z" as const, sourceCutoff: "2026-08-04" as const,
    publicationEligible: false as const, review: { status: "proposed" as const, reviewer: null, reviewedAt: null },
    source: { sourceLockId: "downballot-presidential-cd-2024-csv" as const, sourceUrl: "https://docs.google.com/spreadsheets/d/1ng1i_Dm_RMDnEvauH44pgE6JCUsapcuu8F2pCfeLWFo/export?format=csv&gid=1491069057" as const, fileSha256: "938410ae6b42104eb6ee73ff1fcb4de13f39c2aefa607c73b5664eec9ade974e" as const, byteSize: 55833 as const, authority: "editorial" as const, licenseRecordedInProductionSnapshot: "publisher-publication" as const, productionSnapshotId: "snap_full_elections" as const, productionSnapshotSha256: "938410ae6b42104eb6ee73ff1fcb4de13f39c2aefa607c73b5664eec9ade974e" as const, productionSnapshotUsageStatus: "approved" as const, parserVersion: "downballot-cd-exact-csv-v1" as const },
    geometry: { sourceLockId: "geo-national-cd119" as const, fileSha256: input.geometryFileSha256, cdSession: "119" as const, votingDistrictKeys: 435 as const, compatibilityStatus: "proposed" as const },
    methodology: { id: "downballot-cd-2020-current-boundary-proposal-v1" as const, lineageStatus: "modeled" as const, denominator: "all_presidential_votes" as const, formula: "100 * (Biden votes - Trump votes) / total votes" as const, geographyClaim: "publisher_calculation_for_district_lines_used_in_2024" as const },
    summary: { districtFacts: 435 as const, targetSeatFacts: 212 as const, geometryKeyMatches: 435 as const, production2024Crosschecks: 212 as const, production2024CrosscheckFailures: 0 as const, decisions: 2 as const },
    districtFacts: rows, targetSeatFacts,
    decisions: [
      { decisionId: "approve-current-boundary-compatibility" as const, question: "Should the publisher's 2020 calculations for district lines used in 2024 be accepted as current-boundary-compatible modeled inputs for CD119 reviewer evaluation?", recommendedDecision: "approve only after reviewing the publisher methodology and the exact 435-key Census CD119 closure", defaultReversibleAssumption: "exclude_from_scoring_and_publication" as const, alternatives: ["require a precinct-to-CD119 allocation with state-level conservation", "reject the compatibility claim"], consequences: ["Approval permits these modeled 2020 margins into a later reviewer-only evaluation.", "Deferral keeps all 2020 margins out of scores and publication."], blocksPublication: true as const, blocksOtherWork: false as const, resolution: null },
      { decisionId: "approve-editorial-source-use" as const, question: "Should the existing production snapshot's publisher-publication terms and editorial authority be accepted for this additional 2020 modeled use?", recommendedDecision: "approve only after retaining a versioned terms and source-authority assessment", defaultReversibleAssumption: "exclude_from_scoring_and_publication" as const, alternatives: ["obtain written permission", "use a source-locked precinct overlay from reusable primary inputs", "reject this source use"], consequences: ["Approval authorizes this exact byte artifact only for the reviewed modeled use.", "Deferral keeps the candidate facts retained but non-score-bearing."], blocksPublication: true as const, blocksOtherWork: false as const, resolution: null },
    ],
  };
  return presidentialCurrentBoundaryProposalSchema.parse({ ...unsigned, packageSha256: hash("dsa-seats:presidential-current-boundary-review-proposal:v1\0", unsigned) });
}

export function validatePresidentialCurrentBoundaryProposal(value: unknown): PresidentialCurrentBoundaryProposal {
  const parsed = presidentialCurrentBoundaryProposalSchema.parse(value); const { packageSha256, ...unsigned } = parsed;
  if (packageSha256 !== hash("dsa-seats:presidential-current-boundary-review-proposal:v1\0", unsigned)) throw new Error("PRESIDENTIAL_2020_PROPOSAL_HASH_MISMATCH");
  if (new Set(parsed.districtFacts.map((row) => key(row.stateCode, row.districtCode))).size !== 435 || new Set(parsed.targetSeatFacts.map((row) => row.seatCycleId)).size !== 212 || new Set(parsed.decisions.map((row) => row.decisionId)).size !== 2) throw new Error("PRESIDENTIAL_2020_PROPOSAL_CLOSURE_INVALID");
  return parsed;
}
