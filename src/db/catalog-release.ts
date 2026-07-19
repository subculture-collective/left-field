import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { loadNationwideManifest, loadPrototypeManifest } from "./manifest";
import { computeCanonicalDataChecksum, validateReleaseManifest } from "@/domain/validate-manifest";

type Runner = Pool | PoolClient;
export type ContentDomain = "identity" | "geography" | "member" | "acs" | "finance" | "elections" | "maps";
type TableSpec = Readonly<{ name: string; columns: readonly string[]; domains: readonly ContentDomain[] }>;

/* This is deliberately the sole runtime inventory.  It is also the order in which
 * a release is copied: parents precede children and self-referencing filings are
 * safe because their source order is immaterial to the already-valid graph. */
const spec = (name: string, columns: readonly string[], domains: readonly ContentDomain[]): TableSpec => ({ name, columns, domains });
export const contentTableRegistry: readonly TableSpec[] = Object.freeze([
  spec("sources", ["id","name","authority","homepage_url"], ["identity","geography","member","acs","finance","elections","maps"]),
  spec("source_snapshots", ["id","source_id","source_url","published_at","retrieved_at","checksum_sha256","parser_version","license","usage_status"], ["identity","geography","member","acs","finance","elections","maps"]),
  spec("district_plans", ["id","name","congress","enacted_at","effective_from","effective_to","jurisdiction_state_code"], ["geography"]),
  spec("geometry_artifacts", ["id","snapshot_id","object_key","format","srid","checksum_sha256"], ["geography","maps"]),
  spec("geography_versions", ["id","kind","district_plan_id","geometry_artifact_id","source_geoid","label","vintage","state_code","district_code","boundary","boundary_checksum_sha256"], ["geography","maps"]),
  spec("jurisdictions", ["jurisdiction_code","house_representation","senate_representation"], ["identity"]),
  spec("offices", ["id","chamber","kind","state_code","district_code","senate_class"], ["identity"]),
  spec("people", ["id","display_name","birth_date","bioguide_id"], ["member"]),
  spec("office_terms", ["id","office_id","starts_at","ends_at"], ["identity","member"]),
  spec("memberships", ["id","office_term_id","person_id","party","starts_at","ends_at"], ["member"]),
  spec("seat_cycles", ["id","office_id","office_term_id","geography_version_id","cycle_year","election_date","election_kind","incumbency_status","occupancy_status","occupancy_as_of"], ["identity","geography","member","finance","elections"]),
  spec("release_profile_seats", ["seat_cycle_id","position"], ["identity"]),
  spec("coverage_records", ["domain","scope_key","scope_kind","jurisdiction_code","seat_cycle_id","variable","survey_period","election_year","funding_kind","status","expected_count","observed_count","quarantined_count","incompatible_count"], ["identity","geography","member","acs","finance","elections","maps"]),
  spec("coverage_missing_reasons", ["domain","scope_key","reason","count"], ["identity","geography","member","acs","finance","elections","maps"]),
  spec("coverage_input_snapshots", ["domain","scope_key","snapshot_id"], ["identity","geography","member","acs","finance","elections","maps"]),
  spec("biographical_facts", ["person_id","fact","value","value_missing_reason","effective_at"], ["member"]), spec("biographical_fact_provenance", ["person_id","fact","effective_at","snapshot_id","role"], ["member"]),
  spec("committees", ["id","source_committee_id","name","committee_type"], ["finance"]), spec("committee_assignments", ["person_id","committee_id","role","effective_from","effective_to"], ["member","finance"]), spec("committee_assignment_provenance", ["person_id","committee_id","role_name","effective_from","snapshot_id","provenance_role"], ["member","finance"]),
  spec("contests", ["id","seat_cycle_id","kind","round","election_date","geography_version_id","certification_status","reporting_completeness_percent","denominator_votes","denominator_missing_reason","reporting_unit","allocation_method","allocation_coverage_percent","allocation_coverage_missing_reason","lineage_as_of","lineage_methodology","lineage_status"], ["elections"]), spec("candidacies", ["id","contest_id","person_id","party","status"], ["elections","member"]), spec("result_options", ["id","contest_id","candidacy_id","label","party","option_kind"], ["elections"]), spec("election_results", ["contest_id","result_option_id","votes","votes_missing_reason","lineage_as_of","lineage_methodology","lineage_status"], ["elections"]), spec("contest_lineage", ["contest_id","snapshot_id","role"], ["elections"]), spec("election_result_lineage", ["contest_id","result_option_id","snapshot_id","role"], ["elections"]),
  spec("acs_observations", ["geography_version_id","variable","label","estimate","estimate_missing_reason","margin_of_error","margin_of_error_missing_reason","unit","survey_period","universe","lineage_as_of","lineage_methodology","lineage_status"], ["acs"]), spec("acs_observation_lineage", ["geography_version_id","variable","survey_period","snapshot_id","role"], ["acs"]), spec("acs_variables", ["id","variable","label","unit","survey_period","universe","definition_kind","census_variable","published_moe_method","derivation_formula_version","moe_propagation_method"], ["acs"]), spec("acs_variable_inputs", ["acs_variable_id","snapshot_id"], ["acs"]), spec("acs_variable_dependencies", ["acs_variable_id","dependency_kind","dependency_variable_id"], ["acs"]),
  spec("committee_relationships", ["id","committee_id","candidacy_id","relationship","effective_from","effective_to"], ["finance"]), spec("fec_filing_summaries", ["id","seat_cycle_id","committee_id","source_filing_id","report_type","reporting_period_start","reporting_period_end","filed_at","amendment_number","amendment_status","amends_filing_id","cash_on_hand","cash_on_hand_missing_reason","total_receipts","total_receipts_missing_reason","total_disbursements","total_disbursements_missing_reason","lineage_as_of","lineage_methodology","lineage_status"], ["finance"]), spec("fec_filing_lineage", ["filing_id","snapshot_id","role"], ["finance"]), spec("seat_finance_summaries", ["seat_cycle_id","filing_id","missing_reason","as_of"], ["finance"]), spec("seat_finance_summary_lineage", ["seat_cycle_id","snapshot_id","role"], ["finance"]),
  spec("finance_aggregates", ["id","seat_cycle_id","as_of","coverage_through","reporting_period_start","cash_on_hand","cash_on_hand_missing_reason","receipts","receipts_missing_reason","disbursements","disbursements_missing_reason","methodology_version"], ["finance"]), spec("finance_aggregate_inputs", ["finance_aggregate_id","committee_id","filing_id","missing_reason"], ["finance"]), spec("funding_category_aggregates", ["seat_cycle_id","category","amount","amount_missing_reason","coverage_through","methodology_version"], ["finance"]), spec("funding_category_input_snapshots", ["seat_cycle_id","category","coverage_through","methodology_version","snapshot_id"], ["finance"]), spec("funding_organization_aggregates", ["id","seat_cycle_id","organization_name","organization_external_id","amount","amount_missing_reason","coverage_through","methodology_version"], ["finance"]), spec("funding_organization_input_snapshots", ["aggregate_id","snapshot_id"], ["finance"]), spec("outside_spending_aggregates", ["seat_cycle_id","support_amount","support_amount_missing_reason","oppose_amount","oppose_amount_missing_reason","coverage_through","methodology_version"], ["finance"]), spec("outside_spending_input_snapshots", ["seat_cycle_id","coverage_through","methodology_version","snapshot_id"], ["finance"]),
  spec("election_decisions", ["id","jurisdiction_code","election_year","status"], ["elections"]), spec("election_decision_inputs", ["election_decision_id","snapshot_id"], ["elections"]), spec("map_artifacts", ["id","geography_version_id","artifact_id"], ["maps"]), spec("map_artifact_inputs", ["map_artifact_id","snapshot_id"], ["maps"]), spec("snapshot_derivations", ["output_snapshot_id","methodology_version"], ["identity","geography","member","acs","finance","elections","maps"]), spec("snapshot_derivation_inputs", ["output_snapshot_id","input_snapshot_id"], ["identity","geography","member","acs","finance","elections","maps"]),
  spec("provenance", ["entity_type","entity_id","snapshot_id","role"], ["identity","geography","member","finance","elections"]),
] as const);
const domainTables = (domain: ContentDomain): readonly string[] => contentTableRegistry.filter(t => t.domains.includes(domain)).map(t => t.name);
export const contentDomains: Readonly<Record<ContentDomain, readonly string[]>> = Object.freeze({ identity: domainTables("identity"), geography: domainTables("geography"), member: domainTables("member"), acs: domainTables("acs"), finance: domainTables("finance"), elections: domainTables("elections"), maps: domainTables("maps") });
export const releaseScopedTables = contentTableRegistry.map(t => t.name);
export const tableContentDomain: Readonly<Record<string, ContentDomain>> = Object.freeze(Object.fromEntries(contentTableRegistry.flatMap(t => t.domains.map(d => [`${t.name}:${d}`, d]))));
const quote = (id: string): string => { if (!/^[a-z_][a-z0-9_]*$/.test(id)) throw new Error(`Unsafe registry identifier ${id}`); return `"${id}"`; };

/** Release/lifecycle independent canonical identity. SET LOCAL makes temporal JSON stable. */
export async function computeReleaseDigest(db: Runner, releaseId: string, domain: ContentDomain): Promise<{ rowCount: number; sha256: string }> {
  const lines: string[] = [];
  for (const table of contentTableRegistry.filter(t => t.domains.includes(domain))) {
    const pairs = table.columns.flatMap(column => ["'" + column + "'", column === "boundary" ? `encode(ST_AsEWKB(ST_Normalize(t.${quote(column)})),'hex')` : `t.${quote(column)}`]).join(",");
    // The materialized setting applies to this statement even for a Pool caller
    // that did not open a transaction; it never leaks into the pooled session.
    const result = await db.query<{ canonical: string }>(`WITH timezone AS MATERIALIZED (SELECT set_config('TimeZone','UTC',true)) SELECT jsonb_build_object('table',$2::text,'row',jsonb_build_object(${pairs}))::text canonical FROM ${quote(table.name)} t CROSS JOIN timezone WHERE release_id=$1 ORDER BY jsonb_build_object(${pairs})::text`, [releaseId, table.name]);
    lines.push(...result.rows.map(row => row.canonical));
  }
  return { rowCount: lines.length, sha256: createHash("sha256").update(lines.join("\n")).digest("hex") };
}
async function copyTable(client: PoolClient, table: TableSpec, source: string, candidate: string): Promise<void> { const columns = table.columns.map(quote); await client.query(`INSERT INTO ${quote(table.name)}(release_id,${columns.join(",")}) SELECT $1,${columns.map(c => `t.${c}`).join(",")} FROM ${quote(table.name)} t WHERE t.release_id=$2`, [candidate, source]); }
export async function baselineCandidateRelease(pool: Pool, sourceReleaseId: string, candidateReleaseId: string): Promise<void> {
  const client = await pool.connect(); try { await client.query("BEGIN"); for (const id of [sourceReleaseId,candidateReleaseId].sort()) await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [id]);
    const releases = await client.query<{id:string;status:string;source_cutoff: Date}>("SELECT id,status,source_cutoff FROM data_releases WHERE id=ANY($1) FOR UPDATE", [[sourceReleaseId,candidateReleaseId]]);
    if (releases.rowCount !== 2 || !releases.rows.some(r => r.id===candidateReleaseId && r.status==="candidate")) throw new Error("Baseline requires a candidate destination");
    for (const table of contentTableRegistry) { const present=await client.query(`SELECT 1 FROM ${quote(table.name)} WHERE release_id=$1 LIMIT 1`,[candidateReleaseId]); if (present.rowCount) throw new Error("Baseline requires an empty candidate"); }
    const manifest=await client.query<{schema_version:number;canonical_data_checksum_sha256:string;geometry_checksum_sha256:string;content_checksum_sha256:string}>("SELECT schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256 FROM release_manifests WHERE release_id=$1 FOR SHARE",[sourceReleaseId]); if(manifest.rowCount!==1) throw new Error("Source release has no manifest metadata");
    const existing=await client.query<{schema_version:number}>("SELECT schema_version FROM release_manifests WHERE release_id=$1 FOR UPDATE",[candidateReleaseId]); if(existing.rowCount && existing.rows[0]!.schema_version!==manifest.rows[0]!.schema_version) throw new Error("Candidate/source manifest versions differ");
    const m=manifest.rows[0]!;
    const sourceStatus = releases.rows.find((release) => release.id === sourceReleaseId)!.status;
    if (sourceStatus !== "published" && sourceStatus !== "retired" && !(sourceStatus === "candidate" && m.schema_version === 2)) throw new Error("Baseline requires a published/retired source, or a validated v2 candidate");
    const sourceRelease = releases.rows.find((release) => release.id === sourceReleaseId)!;
    const candidateRelease = releases.rows.find((release) => release.id === candidateReleaseId)!;
    if (sourceRelease.source_cutoff.valueOf() !== candidateRelease.source_cutoff.valueOf()) throw new Error("Baseline requires the candidate source cutoff to equal the source release cutoff; temporal enrichment is required to advance it");
    if (m.schema_version === 2) {
      const gate = await client.query("SELECT 1 FROM nationwide_validation_gates WHERE release_id=$1 AND schema_version=2", [sourceReleaseId]);
      const digests = await client.query<{ domain: string }>("SELECT domain FROM release_content_digests WHERE release_id=$1", [sourceReleaseId]);
      if (gate.rowCount !== 1 || digests.rowCount !== Object.keys(contentDomains).length || new Set(digests.rows.map(row => row.domain)).size !== Object.keys(contentDomains).length) throw new Error("Source nationwide validation or domain digests are absent or stale");
    }
    for(const table of contentTableRegistry) await copyTable(client,table,sourceReleaseId,candidateReleaseId);
    const sourceManifest = m.schema_version === 2 ? await loadNationwideManifest(client, sourceReleaseId) : await loadPrototypeManifest(client, sourceReleaseId);
    const targetRelease = await client.query("SELECT id,label,status,source_cutoff,created_at,published_at,previous_release_id FROM data_releases WHERE id=$1", [candidateReleaseId]);
    const target = structuredClone(sourceManifest) as Record<string, unknown>;
    const rewriteReleaseId = (value: unknown): void => { if (Array.isArray(value)) value.forEach(rewriteReleaseId); else if (value && typeof value === "object") { const record = value as Record<string, unknown>; if (record.releaseId === sourceReleaseId) record.releaseId = candidateReleaseId; Object.values(record).forEach(rewriteReleaseId); } };
    rewriteReleaseId(target);
    const release = targetRelease.rows[0]!;
    target.release = { id: release.id, label: release.label, status: release.status, sourceCutoff: new Date(release.source_cutoff).toISOString(), createdAt: new Date(release.created_at).toISOString(), publishedAt: release.published_at === null ? null : new Date(release.published_at).toISOString(), previousReleaseId: release.previous_release_id };
    const canonical = computeCanonicalDataChecksum(target as Parameters<typeof computeCanonicalDataChecksum>[0]);
    target.canonicalDataChecksumSha256 = canonical;
    const validation = validateReleaseManifest(target);
    if (!validation.success) throw new Error(`Baselined manifest is not semantically valid: ${validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
    const content = createHash("sha256").update(JSON.stringify({ data: canonical, geometry: m.geometry_checksum_sha256 })).digest("hex");
    await client.query("INSERT INTO release_manifests(release_id,schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256,validated_at) VALUES($1,$2,$3,$4,$5,NULL) ON CONFLICT(release_id) DO UPDATE SET schema_version=EXCLUDED.schema_version,canonical_data_checksum_sha256=EXCLUDED.canonical_data_checksum_sha256,geometry_checksum_sha256=EXCLUDED.geometry_checksum_sha256,content_checksum_sha256=EXCLUDED.content_checksum_sha256,validated_at=NULL",[candidateReleaseId,m.schema_version,canonical,m.geometry_checksum_sha256,content]);
    await client.query("DELETE FROM nationwide_validation_gates WHERE release_id=$1", [candidateReleaseId]);
    await client.query("DELETE FROM release_content_digests WHERE release_id=$1",[candidateReleaseId]);
    for(const domain of Object.keys(contentDomains) as ContentDomain[]){const source=await computeReleaseDigest(client,sourceReleaseId,domain);const candidate=await computeReleaseDigest(client,candidateReleaseId,domain);if(source.rowCount!==candidate.rowCount||source.sha256!==candidate.sha256) throw new Error(`Baseline digest mismatch for ${domain}`);await client.query("INSERT INTO release_content_digests(release_id,domain,row_count,sha256,validated_at) VALUES($1,$2,$3,$4,now())",[candidateReleaseId,domain,candidate.rowCount,candidate.sha256]);} await client.query("COMMIT");
  } catch(error){await client.query("ROLLBACK");throw error;} finally {client.release();}}

type ManifestRow = {
  schema_version: number;
  canonical_data_checksum_sha256: string;
  geometry_checksum_sha256: string;
  content_checksum_sha256: string;
};
type Digest = { domain: ContentDomain; rowCount: number; sha256: string };
type StoredDigest = { domain: string; row_count: number; sha256: string };
type ValidationGate = {
  schema_version: number;
  manifest_checksum_sha256: string;
  geometry_checksum_sha256: string;
  content_checksum_sha256: string;
  domain_count: number;
  domain_checksum_sha256: string;
};

const nationwideDomains = Object.keys(contentDomains).sort() as ContentDomain[];

function domainSummary(digests: readonly Digest[]): string {
  const lines = [...digests]
    .sort((left, right) => left.domain.localeCompare(right.domain))
    .map((digest) => `${digest.domain}:${digest.rowCount}:${digest.sha256}`);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function expectedContentChecksum(manifest: ManifestRow): string {
  return createHash("sha256")
    .update(JSON.stringify({ data: manifest.canonical_data_checksum_sha256, geometry: manifest.geometry_checksum_sha256 }))
    .digest("hex");
}

function assertManifestChecksums(manifest: ManifestRow, loadedChecksum: string): void {
  if (loadedChecksum !== manifest.canonical_data_checksum_sha256 || expectedContentChecksum(manifest) !== manifest.content_checksum_sha256) {
    throw new Error("Nationwide manifest checksums are inconsistent");
  }
}

async function lockV2Candidate(client: PoolClient, releaseId: string): Promise<ManifestRow> {
  return lockV2Release(client, releaseId, ["candidate"], "Nationwide validation requires a v2 candidate");
}

async function lockV2Release(client: PoolClient, releaseId: string, statuses: readonly string[], errorMessage: string): Promise<ManifestRow> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('dsa_seats_release:' || $1))", [releaseId]);
  const release = await client.query("SELECT 1 FROM data_releases WHERE id=$1 AND status=ANY($2) FOR UPDATE", [releaseId, statuses]);
  const manifest = await client.query<ManifestRow>("SELECT schema_version,canonical_data_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256 FROM release_manifests WHERE release_id=$1 FOR UPDATE", [releaseId]);
  if (release.rowCount !== 1 || manifest.rowCount !== 1 || manifest.rows[0]!.schema_version !== 2) throw new Error(errorMessage);
  return manifest.rows[0]!;
}

async function computeAllDigests(client: PoolClient, releaseId: string): Promise<Digest[]> {
  const digests: Digest[] = [];
  for (const domain of nationwideDomains) digests.push({ domain, ...await computeReleaseDigest(client, releaseId, domain) });
  return digests;
}

/** Recompute and bind the v2 content digests while the candidate is locked. */
export async function validateNationwideCandidateReleaseWithClient(client: PoolClient, releaseId: string): Promise<void> {
  const manifest = await lockV2Candidate(client, releaseId);
  const loaded = await loadNationwideManifest(client, releaseId);
  assertManifestChecksums(manifest, loaded.canonicalDataChecksumSha256);
  const digests = await computeAllDigests(client, releaseId);

  // Digest replacement must happen before the new gate exists, because content writes invalidate gates.
  await client.query("DELETE FROM nationwide_validation_gates WHERE release_id=$1", [releaseId]);
  await client.query("DELETE FROM release_content_digests WHERE release_id=$1", [releaseId]);
  for (const digest of digests) {
    await client.query("INSERT INTO release_content_digests(release_id,domain,row_count,sha256,validated_at) VALUES($1,$2,$3,$4,now())", [releaseId, digest.domain, digest.rowCount, digest.sha256]);
  }
  await client.query("INSERT INTO nationwide_validation_gates(release_id,schema_version,manifest_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256,domain_count,domain_checksum_sha256,validated_at) VALUES($1,2,$2,$3,$4,$5,$6,now())", [releaseId, manifest.canonical_data_checksum_sha256, manifest.geometry_checksum_sha256, manifest.content_checksum_sha256, digests.length, domainSummary(digests)]);
  await client.query("UPDATE release_manifests SET validated_at=now() WHERE release_id=$1", [releaseId]);
}

export async function validateNationwideCandidateRelease(pool: Pool, releaseId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await validateNationwideCandidateReleaseWithClient(client, releaseId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function recheckWithClient(client: PoolClient, releaseId: string): Promise<void> {
  const manifest = await lockV2Release(client, releaseId, ["candidate", "retired", "published"], "Nationwide recheck requires a v2 candidate, retired, or published release");
  const loaded = await loadNationwideManifest(client, releaseId);
  assertManifestChecksums(manifest, loaded.canonicalDataChecksumSha256);
  const gateResult = await client.query<ValidationGate>("SELECT schema_version,manifest_checksum_sha256,geometry_checksum_sha256,content_checksum_sha256,domain_count,domain_checksum_sha256 FROM nationwide_validation_gates WHERE release_id=$1 FOR SHARE", [releaseId]);
  const digestResult = await client.query<StoredDigest>("SELECT domain,row_count,sha256 FROM release_content_digests WHERE release_id=$1 FOR SHARE", [releaseId]);
  if (gateResult.rowCount !== 1 || digestResult.rowCount !== nationwideDomains.length) throw new Error("Nationwide validation gate or digests are missing");

  const stored = new Map(digestResult.rows.map((digest) => [digest.domain, digest]));
  if (stored.size !== nationwideDomains.length || nationwideDomains.some((domain) => !stored.has(domain))) throw new Error("Nationwide validation digests have an invalid domain set");
  const current = await computeAllDigests(client, releaseId);
  for (const digest of current) {
    const saved = stored.get(digest.domain)!;
    if (Number(saved.row_count) !== digest.rowCount || saved.sha256 !== digest.sha256) throw new Error(`Nationwide validation digest is stale for ${digest.domain}`);
  }
  const gate = gateResult.rows[0]!;
  if (gate.schema_version !== 2 || gate.manifest_checksum_sha256 !== manifest.canonical_data_checksum_sha256 || gate.geometry_checksum_sha256 !== manifest.geometry_checksum_sha256 || gate.content_checksum_sha256 !== manifest.content_checksum_sha256 || gate.domain_count !== nationwideDomains.length || gate.domain_checksum_sha256 !== domainSummary(current)) throw new Error("Nationwide validation gate is stale or forged");
}

/** Read-only, fail-closed verification of an already persisted nationwide validation gate. */
export async function recheckNationwideValidationGate(connection: Pool | PoolClient, releaseId: string): Promise<void> {
  if (typeof (connection as PoolClient).release === "function") return recheckWithClient(connection as PoolClient, releaseId);
  const client = await (connection as Pool).connect();
  try {
    await client.query("BEGIN");
    await recheckWithClient(client, releaseId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
