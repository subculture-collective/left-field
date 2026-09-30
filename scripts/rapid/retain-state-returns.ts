/**
 * Retain the official state-legislative general-election returns every
 * registered state adapter declares, and pin them in the source lock.
 *
 *   npm run rapid:state-returns                 retain every declared source that is not yet on disk
 *   npm run rapid:state-returns -- --state GA   only one state
 *   npm run rapid:state-returns -- --check      verify retained bytes against the lock; download nothing
 *
 * Downloads are HTTPS only and written under data/source/rapid/state-general/.
 * A file already on disk is verified against the lock, never overwritten; a
 * publisher that re-issues a file under the same URL therefore fails closed
 * and the adapter must declare a new source id.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { derivedArtifactEntry, findSourceLockEntry, readSourceLock, upsertSourceLockEntry, writeSourceLock, type SourceLock } from "@/rapid-acquisition/intake/source-lock";
import { sha } from "@/rapid-acquisition/shared";
import { STATE_GENERAL_ADAPTERS } from "@/rapid-acquisition/state-general";

const args = process.argv.slice(2);
const option = (name: string): string | undefined => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const checkOnly = args.includes("--check");
const only = option("state")?.toUpperCase();
const out = (line: string) => process.stdout.write(`${line}\n`);

async function download(url: string): Promise<Buffer> {
  if (!url.startsWith("https://")) throw new Error(`STATE_RETURNS_URL_NOT_HTTPS:${url}`);
  const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": "dsa-seats-intake (+https://git.subcult.tv/subculture-collective/dsa-seats)" } });
  if (!response.ok) throw new Error(`STATE_RETURNS_DOWNLOAD_FAILED:${response.status}:${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function retain(lock: SourceLock, id: string, path: string, url: string): Promise<SourceLock> {
  const existing = findSourceLockEntry(lock, id);
  if (existsSync(path)) {
    const bytes = readFileSync(path);
    if (existing && (existing.sha256 !== sha(bytes) || existing.byteSize !== bytes.length)) throw new Error(`STATE_RETURNS_EXISTING_MISMATCH:${id}`);
    out(`${id}: retained (${bytes.length} bytes)`);
    return existing ? lock : upsertSourceLockEntry(lock, derivedArtifactEntry({ id, url, retainedPath: path, bytes, kind: "official_state_returns", parentIds: [] }));
  }
  if (checkOnly) throw new Error(`STATE_RETURNS_MISSING:${id}`);
  const bytes = await download(url);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  out(`${id}: downloaded ${bytes.length} bytes sha256 ${sha(bytes)}`);
  return upsertSourceLockEntry(lock, derivedArtifactEntry({ id, url, retainedPath: path, bytes, kind: "official_state_returns", parentIds: [] }));
}

async function main(): Promise<void> {
  let lock = readSourceLock();
  const adapters = STATE_GENERAL_ADAPTERS.filter((adapter) => !only || adapter.stateCode === only);
  if (adapters.length === 0) throw new Error(`STATE_RETURNS_NO_ADAPTER:${only ?? "any"}`);
  for (const adapter of adapters) for (const source of adapter.sources) lock = await retain(lock, source.id, source.path, source.url);
  writeSourceLock(lock);
  out(`${adapters.length} state(s), ${adapters.reduce((sum, adapter) => sum + adapter.sources.length, 0)} source(s) retained. Next: npm run rapid:intake -- derive state-legislative-general-results-v1`);
}

main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exit(1); });
