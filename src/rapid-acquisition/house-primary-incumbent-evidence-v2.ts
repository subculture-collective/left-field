import { readRetainedSource, readSourceLock, type SourceLock } from "./intake/source-lock";
import { validateHousePrimaryIncumbentEvidence, type HousePrimaryIncumbentEvidenceRow } from "./house-primary-incumbent-evidence";
import { byteCompare, exact, hash } from "./shared";

/**
 * Incumbent primary evidence v2: v1 plus reviewed identity aliases.
 *
 * V1 left RI-01 unresolved because the source prints "Gabriel Amo" while the
 * House roster prints "Gabe Amo" and no retained file bridged the two given
 * names. V2 consults `house-identity-aliases-v1`, a reviewed alias table, and
 * resolves a row only when the alias binds the same bioguide id, district,
 * source artifact, and source spelling. Every other v1 row is carried through
 * unchanged, and no winner or nomination is inferred.
 */
type V1Row = HousePrimaryIncumbentEvidenceRow;
type V2IdentityStatus = V1Row["identityStatus"] | "reviewed_alias_relationship";
type V2IdentityMethod = V1Row["identityMethod"] | "reviewed_alias_table_given_name";

export interface HousePrimaryIncumbentEvidenceV2Row extends Omit<V1Row, "identityStatus" | "identityMethod" | "rowSha256"> {
  readonly identityStatus: V2IdentityStatus;
  readonly identityMethod: V2IdentityMethod;
  readonly aliasId: string | null;
  readonly parentV1RowSha256: string;
  readonly rowSha256: string;
}

export interface HousePrimaryIncumbentEvidenceV2 {
  readonly schema: "rapid-house-primary-2024-incumbent-evidence-v2";
  readonly version: 2;
  readonly sourceIds: readonly string[];
  readonly rows: readonly HousePrimaryIncumbentEvidenceV2Row[];
  readonly rowSetSha256: string;
  readonly summary: Readonly<{ observations: number; exactIdentityLinks: number; derivedIdentityLinks: number; reviewedAliasLinks: number; unresolvedIdentityRows: number; formulaEligibleRows: number; linkedCandidateVotes: number; eligibleContestVotes: number; winnerInferences: 0 }>;
  readonly packageSha256: string;
}

export const INCUMBENT_EVIDENCE_V2 = {
  id: "rapid-house-primary-2024-incumbent-evidence-v2",
  path: "data/metadata/rapid-house-primary-2024-incumbent-evidence-v2.json",
  url: "urn:dsa-seats:rapid-house-primary-2024-incumbent-evidence:v2",
  parentIds: ["rapid-house-primary-2024-incumbent-evidence-v1", "house-identity-aliases-v1"],
} as const;

type Alias = Readonly<{ aliasId: string; bioguideId: string; officialHouseName: string; districtLabel: string; sourceName: string; sourceArtifactId: string; relationship: string; basis: string; reviewedOn: string; reviewer: string }>;
type AliasTable = Readonly<{ schema: "house-identity-aliases-v1"; version: 1; aliases: readonly Alias[] }>;

const one = (value: number) => Math.round(value * 10) / 10;
const stripMarker = (value: string) => value.replace(/\*$/, "").trim();

function aliasTable(lock: SourceLock, root: string): AliasTable {
  const { bytes } = readRetainedSource(lock, "house-identity-aliases-v1", root);
  const table = JSON.parse(bytes.toString("utf8")) as AliasTable;
  if (table.schema !== "house-identity-aliases-v1" || table.version !== 1 || !Array.isArray(table.aliases)) throw new Error("HOUSE_IDENTITY_ALIASES_INVALID");
  if (new Set(table.aliases.map((alias) => alias.aliasId)).size !== table.aliases.length) throw new Error("HOUSE_IDENTITY_ALIASES_DUPLICATE");
  for (const alias of table.aliases)
    if (!alias.bioguideId || !alias.districtLabel || !alias.sourceName || !alias.sourceArtifactId || !alias.basis || !/^\d{4}-\d{2}-\d{2}$/.test(alias.reviewedOn)) throw new Error(`HOUSE_IDENTITY_ALIASES_ROW_INVALID:${alias.aliasId}`);
  return table;
}

export function buildHousePrimaryIncumbentEvidenceV2(root = process.cwd(), lock: SourceLock = readSourceLock(root)): HousePrimaryIncumbentEvidenceV2 {
  const v1Bytes = readRetainedSource(lock, "rapid-house-primary-2024-incumbent-evidence-v1", root).bytes;
  const v1 = validateHousePrimaryIncumbentEvidence(JSON.parse(v1Bytes.toString("utf8")), root);
  const aliases = aliasTable(lock, root);
  const used = new Set<string>();
  const rows = v1.rows.map((row): HousePrimaryIncumbentEvidenceV2Row => {
    const { rowSha256: parentV1RowSha256, ...carried } = row;
    const alias = aliases.aliases.find((candidate) => candidate.bioguideId === row.bioguideId && candidate.districtLabel === row.districtLabel && candidate.sourceArtifactId === row.sourceArtifactId && candidate.sourceName === stripMarker(row.sourceCandidateName) && candidate.officialHouseName === row.officialHouseName);
    if (!alias || row.formulaEligible) {
      const unsigned = { ...carried, aliasId: null, parentV1RowSha256 };
      return { ...unsigned, rowSha256: hash("dsa-seats:rapid-house-primary-incumbent-evidence-row:v2", unsigned) };
    }
    if (row.identityStatus !== "unresolved_no_retained_given_name_bridge") throw new Error(`HOUSE_PRIMARY_INCUMBENT_V2_ALIAS_TARGET_INVALID:${row.districtLabel}`);
    used.add(alias.aliasId);
    const incumbentVotes = row.sourceCandidateVotes, incumbentVoteShare = one((100 * incumbentVotes) / row.contestVotes);
    const unsigned = { ...carried, incumbentVotes, incumbentVoteShare, primaryVulnerability: one(100 - incumbentVoteShare), identityStatus: "reviewed_alias_relationship" as const, identityMethod: "reviewed_alias_table_given_name" as const, formulaEligible: true, aliasId: alias.aliasId, parentV1RowSha256 };
    return { ...unsigned, rowSha256: hash("dsa-seats:rapid-house-primary-incumbent-evidence-row:v2", unsigned) };
  }).sort((left, right) => byteCompare(left.districtLabel, right.districtLabel));
  for (const alias of aliases.aliases) if (!used.has(alias.aliasId)) throw new Error(`HOUSE_PRIMARY_INCUMBENT_V2_ALIAS_UNUSED:${alias.aliasId}`);
  const summary = {
    observations: rows.length,
    exactIdentityLinks: rows.filter((row) => row.identityStatus === "exact_name_observation").length,
    derivedIdentityLinks: rows.filter((row) => row.identityStatus === "derived_name_relationship").length,
    reviewedAliasLinks: rows.filter((row) => row.identityStatus === "reviewed_alias_relationship").length,
    unresolvedIdentityRows: rows.filter((row) => row.identityStatus.startsWith("unresolved")).length,
    formulaEligibleRows: rows.filter((row) => row.formulaEligible).length,
    linkedCandidateVotes: rows.reduce((sum, row) => sum + (row.incumbentVotes ?? 0), 0),
    eligibleContestVotes: rows.reduce((sum, row) => sum + (row.formulaEligible ? row.contestVotes : 0), 0),
    winnerInferences: 0 as const,
  };
  if (rows.some((row) => row.winnerInference !== null)) throw new Error("HOUSE_PRIMARY_INCUMBENT_V2_WINNER_INFERENCE");
  const unsigned = { schema: "rapid-house-primary-2024-incumbent-evidence-v2" as const, version: 2 as const, sourceIds: [...INCUMBENT_EVIDENCE_V2.parentIds], rows, rowSetSha256: hash("dsa-seats:rapid-house-primary-incumbent-evidence-row-set:v2", rows), summary };
  return { ...unsigned, packageSha256: hash("dsa-seats:rapid-house-primary-incumbent-evidence-package:v2", unsigned) };
}

export function validateHousePrimaryIncumbentEvidenceV2(value: unknown, root = process.cwd()): HousePrimaryIncumbentEvidenceV2 {
  const expected = buildHousePrimaryIncumbentEvidenceV2(root);
  if (!exact(value, expected)) throw new Error("HOUSE_PRIMARY_INCUMBENT_EVIDENCE_V2_INVALID");
  return value as HousePrimaryIncumbentEvidenceV2;
}

export function readHousePrimaryIncumbentEvidenceV2(root = process.cwd(), lock: SourceLock = readSourceLock(root)): HousePrimaryIncumbentEvidenceV2 {
  const { bytes } = readRetainedSource(lock, INCUMBENT_EVIDENCE_V2.id, root);
  return validateHousePrimaryIncumbentEvidenceV2(JSON.parse(bytes.toString("utf8")), root);
}
