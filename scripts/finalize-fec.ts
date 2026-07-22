import { closeDb, getIngestPool } from "@/db/client";
import { releaseIdSchema } from "@/domain/contracts";
import { finalizeCandidateFec, type FecFinalizationSnapshot, type FecFinalizationSource, type FinalizationSource, type MappingFinalizationSnapshot } from "@/ingestion/fec/finalize-fec";
import { canonicalizeFecFinanceScope } from "@/ingestion/fec/envelope";
import type { FecCandidateMapping } from "@/ingestion/fec/aggregates";
import { createRawObjectStore, verifyConfiguredSourceLock } from "./ingestion-config";

export interface FinalizeFecArguments { readonly release: string; readonly sourceRelease: string; readonly runIds: readonly [string]; readonly source: FecFinalizationSource; readonly snapshot: FecFinalizationSnapshot; readonly mappingSource: FinalizationSource; readonly mappingSnapshot: MappingFinalizationSnapshot; readonly mapping: FecCandidateMapping; readonly financeScope: ReturnType<typeof canonicalizeFecFinanceScope>; }
const message = "Require --release, --source-release, exactly one --run, and exact JSON --source, --snapshot, --mapping-source, --mapping-snapshot, --mapping, and --finance-scope (one canonical envelope/run contains every committee, page, and scope).";
const json = <T>(value: string | undefined): T => { try { if (!value) throw new Error(); return JSON.parse(value) as T; } catch { throw new Error(message); } };
const keys = "checksumSha256,id,license,parserVersion,publishedAt,retrievedAt,sourceId,sourceUrl,usageStatus";
const validTimestamp = (value: unknown) => typeof value === "string" && !Number.isNaN(new Date(value).valueOf());
const nonemptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;
export function parseMappingFinalizationSource(value: unknown): FinalizationSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  const source = value as FinalizationSource;
  if (Object.keys(source).sort().join(",") !== "authority,homepageUrl,id,name" || !nonemptyString(source.id) || !nonemptyString(source.name) || !nonemptyString(source.authority) || !nonemptyString(source.homepageUrl)) throw new Error(message);
  return source;
}
export function parseMappingFinalizationSnapshot(value: unknown): MappingFinalizationSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  const snapshot = value as MappingFinalizationSnapshot;
  if (Object.keys(snapshot).sort().join(",") !== keys || !nonemptyString(snapshot.id) || !nonemptyString(snapshot.sourceId) || !nonemptyString(snapshot.sourceUrl) || !nonemptyString(snapshot.checksumSha256) || !/^[a-f0-9]{64}$/.test(snapshot.checksumSha256) || (snapshot.publishedAt !== null && !validTimestamp(snapshot.publishedAt)) || !validTimestamp(snapshot.retrievedAt) || !nonemptyString(snapshot.license) || !nonemptyString(snapshot.parserVersion) || snapshot.usageStatus !== "approved") throw new Error(message);
  return snapshot;
}
export function parseFinalizeFecArguments(argv: readonly string[]): FinalizeFecArguments {
  const repeated = new Map<string, string[]>(); const singleton = new Map<string, string>(); const known = new Set(["--release", "--source-release", "--run", "--source", "--snapshot", "--mapping-source", "--mapping-snapshot", "--mapping", "--finance-scope"]);
  for (let i = 0; i < argv.length; i += 1) { const key = argv[i], value = argv[i + 1]; if (!key || !known.has(key) || !value || value.startsWith("--")) throw new Error(message); i += 1; if (key === "--run") repeated.set(key, [...(repeated.get(key) ?? []), value]); else { if (singleton.has(key)) throw new Error(message); singleton.set(key, value); } }
  const release = singleton.get("--release"), sourceRelease = singleton.get("--source-release"), runIds = repeated.get("--run") ?? [];
  if (!release || !sourceRelease || release === sourceRelease || !releaseIdSchema.safeParse(release).success || !releaseIdSchema.safeParse(sourceRelease).success || runIds.length !== 1) throw new Error(message);
  const source = json<FecFinalizationSource>(singleton.get("--source")), snapshot = json<FecFinalizationSnapshot>(singleton.get("--snapshot")), mappingSource = parseMappingFinalizationSource(json(singleton.get("--mapping-source"))), mappingSnapshot = parseMappingFinalizationSnapshot(json(singleton.get("--mapping-snapshot"))), mapping = json<FecCandidateMapping>(singleton.get("--mapping"));
  const validSource = (value: FinalizationSource) => Object.keys(value).sort().join(",") === "authority,homepageUrl,id,name" && nonemptyString(value.id) && nonemptyString(value.name) && nonemptyString(value.authority) && nonemptyString(value.homepageUrl);
  const validSnapshot = (value: FecFinalizationSnapshot) => Object.keys(value).sort().join(",") === keys && nonemptyString(value.id) && nonemptyString(value.sourceId) && nonemptyString(value.sourceUrl) && nonemptyString(value.checksumSha256) && /^[a-f0-9]{64}$/.test(value.checksumSha256) && (value.publishedAt === null || validTimestamp(value.publishedAt)) && validTimestamp(value.retrievedAt) && nonemptyString(value.license) && value.parserVersion === "openfec-sanitized-v1" && value.usageStatus === "approved";
  if (!validSource(source) || source.name !== "fec" || source.authority !== "official" || !validSnapshot(snapshot) || snapshot.sourceId !== source.id || mappingSnapshot.sourceId !== mappingSource.id || mapping.snapshotId !== mappingSnapshot.id) throw new Error(message);
  let financeScope: ReturnType<typeof canonicalizeFecFinanceScope>; try { financeScope = canonicalizeFecFinanceScope(json(singleton.get("--finance-scope"))); } catch { throw new Error(message); }
  return { release, sourceRelease, runIds: [runIds[0]!], source, snapshot, mappingSource, mappingSnapshot, mapping, financeScope };
}
export async function main(argv = process.argv.slice(2), env = process.env): Promise<void> { const args = parseFinalizeFecArguments(argv); const { sha256: sourceLockSha256 } = await verifyConfiguredSourceLock(env); await finalizeCandidateFec({ pool: getIngestPool(), rawStore: createRawObjectStore(env), candidateReleaseId: args.release, sourceReleaseId: args.sourceRelease, runIds: args.runIds, sourceLockSha256, source: args.source, snapshot: args.snapshot, mappingSource: args.mappingSource, mappingSnapshot: args.mappingSnapshot, mapping: args.mapping, financeScope: args.financeScope }); process.stdout.write(`${JSON.stringify({ release: args.release, status: "validated_candidate" })}\n`); }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "FEC finalization failed"}\n`); process.exitCode = 1; }).finally(closeDb);
