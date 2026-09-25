/**
 * Publish a new Priority Index release from the current retained inputs.
 *
 *   npm run rapid:publish -- --version v1.1 [--date 2026-10-01]
 *
 * Steps, in order: re-derive every registered derived artifact whose parents
 * changed (all of them, in registry order, to keep the chain closed); write and
 * pin the release descriptor; write a review note skeleton with the digests;
 * run the source-lock verifier. Nothing here edits source code, and the House
 * layer is only re-derived, never re-modelled.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { derivedArtifactEntry, readSourceLock, upsertSourceLockEntry, writeSourceLock } from "@/rapid-acquisition/intake/source-lock";
import { readRefreshInputs } from "@/rapid-acquisition/refresh-inputs";
import { sha } from "@/rapid-acquisition/shared";
import { HOUSE_SCORE_V10 } from "@/rapid-acquisition/house-score-v10-active";
import { SENATE_SCORE_V01 } from "@/rapid-acquisition/senate-score-v01";
import { PRIORITY_INDEX_RELEASE, readPriorityIndexRelease, serializePriorityIndexRelease, type PriorityIndexRelease } from "@/lib/priority-index-release";

import { DERIVED_ARTIFACTS, derivedParentIds } from "./derived-artifacts";

const args = process.argv.slice(2);
const option = (name: string): string | undefined => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const version = option("version") ?? (() => { throw new Error("usage: rapid:publish --version vX.Y [--date YYYY-MM-DD]"); })();
if (!/^v\d+\.\d+$/.test(version)) throw new Error(`PUBLISH_VERSION_INVALID:${version}`);
const date = option("date") ?? new Date().toISOString().slice(0, 10);
const out = (line: string) => process.stdout.write(`${line}\n`);

function main(): void {
  const root = process.cwd();
  const previous = readPriorityIndexRelease(root);
  const digests: string[] = [];
  for (const artifact of DERIVED_ARTIFACTS) {
    const lock = readSourceLock(root);
    const value = artifact.build(root, lock);
    const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    mkdirSync(dirname(artifact.path), { recursive: true });
    const before = (() => { try { return sha(readFileSync(artifact.path)); } catch { return null; } })();
    writeFileSync(artifact.path, bytes);
    writeSourceLock(upsertSourceLockEntry(lock, derivedArtifactEntry({ id: artifact.id, url: artifact.url, retainedPath: artifact.path, bytes, kind: artifact.kind, parentIds: [...derivedParentIds(artifact, root, lock)] })));
    const record = value as { packageSha256?: string };
    digests.push(`- \`${artifact.id}\`: ${bytes.length.toLocaleString("en-US")} bytes; SHA-256 \`${sha(bytes)}\`; package \`${record.packageSha256}\`${before === sha(bytes) ? " (unchanged)" : ""}`);
    out(`${artifact.id}: ${before === sha(bytes) ? "unchanged" : "rebuilt"}`);
  }
  const inputs = readRefreshInputs(root);
  const release: PriorityIndexRelease = {
    ...previous,
    modelVersion: version,
    publishedAt: date,
    chambers: {
      house: { ...previous.chambers.house, artifactId: HOUSE_SCORE_V10.id, modelVersion: "v0.10", financeAsOf: inputs.snapshotDate },
      senate: { artifactId: SENATE_SCORE_V01.id, modelVersion: previous.chambers.senate.modelVersion, sourceCutoff: inputs.snapshotDate, financeAsOf: inputs.snapshotDate },
    },
  };
  const bytes = Buffer.from(serializePriorityIndexRelease(release));
  writeFileSync(PRIORITY_INDEX_RELEASE.path, bytes);
  writeSourceLock(upsertSourceLockEntry(readSourceLock(root), derivedArtifactEntry({ id: PRIORITY_INDEX_RELEASE.id, url: "urn:dsa-seats:priority-index-release:v1", retainedPath: PRIORITY_INDEX_RELEASE.path, bytes, kind: "editorial_ledger", parentIds: [] })));
  const note = `docs/reviews/priority-index-release-${version}-${date}.md`;
  writeFileSync(note, [
    `# Priority Index ${version} — ${date}`,
    "",
    "## Outcome",
    "",
    `Automated release. House layer ${release.chambers.house.modelVersion} (source cutoff ${release.chambers.house.sourceCutoff}); Senate layer ${release.chambers.senate.modelVersion} (FEC and roster snapshot ${inputs.snapshotDate}, \`${inputs.fecCandidateSummaryId}\`). Fill in what changed and why before merging.`,
    "",
    "## Immutable outputs",
    "",
    ...digests,
    "",
    "## Reproduction",
    "",
    "```sh",
    `npm run rapid:refresh -- --date ${inputs.snapshotDate} --skip-download`,
    `npm run rapid:publish -- --version ${version} --date ${date}`,
    "npm run data:verify",
    "npm run test:fast",
    "```",
    "",
  ].join("\n"));
  execFileSync("node", ["scripts/verify-source-lock.mjs"], { stdio: "inherit" });
  out(`published ${version} (${date}); review note ${note}`);
}

main();
