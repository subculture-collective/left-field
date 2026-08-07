import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const sources = [
  { id: "ga-2022-general-primary-election-metadata", url: "https://results.sos.ga.gov/results/public/api/elections/Georgia/2022MayGenPri", path: "data/source/elections/primary-results/georgia/2022/election-metadata.json", bytes: 1805, sha256: "475648a3bdf8e19a00d647ca2592114a4362ed119b412f473a9fad37f4b49f20" },
  { id: "ga-2022-general-primary-total-votes-workbook", url: "https://results.sos.ga.gov/cdn/results/09378a07-e6cf-4f66-be7c-ca4aa534f99a/Total%20Votes%20Results_fb34a8c4-3127-4742-8c5b-691de9c22401.xlsx", path: "data/source/elections/primary-results/georgia/2022/total-votes-results.xlsx", bytes: 1087533, sha256: "157dcaf6c4b972cb7b6a6fbe2a177ca3526a01bc1c4b6d5d3f51d1fa7ee1a880" },
  { id: "ga-2024-general-primary-election-metadata", url: "https://results.sos.ga.gov/results/public/api/elections/Georgia/2024MayGenPri", path: "data/source/elections/primary-results/georgia/2024/election-metadata.json", bytes: 1796, sha256: "0bd53e4fa1733214ddb7ed9bbf45a42c93b1235187534f1db9e6b55f4252761a" },
  { id: "ga-2024-general-primary-total-votes-workbook", url: "https://results.sos.ga.gov/cdn/results/09378a07-e6cf-4f66-be7c-ca4aa534f99a/Total%20Votes%20Results_dd4a2851-411f-4720-abea-3ce4cf813d1f.xlsx", path: "data/source/elections/primary-results/georgia/2024/total-votes-results.xlsx", bytes: 681802, sha256: "1971b455dfcd609d3fa0cf3afe149bb85d8939c0e4551f3e3c34f9e52802714d" },
  { id: "ga-2026-general-primary-election-metadata", url: "https://results.sos.ga.gov/results/public/api/elections/Georgia/GeneralPrimary51926", path: "data/source/elections/primary-results/georgia/2026/election-metadata.json", bytes: 2830, sha256: "4b3bbca5c14942f11b3151e86cfc1f6f041fb60b1f271e729d5695fe8d7d5392" },
  { id: "ga-2026-general-primary-total-votes-workbook", url: "https://results.sos.ga.gov/cdn/results/09378a07-e6cf-4f66-be7c-ca4aa534f99a/Total%20Votes%20Results_f994c55e-4e3f-43f8-86ea-8ac4e9b45807.xlsx", path: "data/source/elections/primary-results/georgia/2026/total-votes-results.xlsx", bytes: 1276496, sha256: "eca6d40576e350db991ea3ec06625f90f71cb655ef912eac624d0d0a6f1a3ada" },
];

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

for (const source of sources) {
  const response = await fetch(source.url, { headers: { "user-agent": "dsa-seats factual source acquisition contact=admin@dsaslate.us" }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`GEORGIA_PRIMARY_FETCH_HTTP:${source.id}:${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== source.bytes || sha(bytes) !== source.sha256) throw new Error(`GEORGIA_PRIMARY_FETCH_DRIFT:${source.id}`);
  await mkdir(dirname(source.path), { recursive: true });
  try { await writeFile(source.path, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error.code !== "EEXIST" || !(await readFile(source.path)).equals(bytes)) throw new Error(`GEORGIA_PRIMARY_FETCH_OUTPUT_CONFLICT:${source.id}`); }
}

console.log(JSON.stringify({ sources: sources.map(({ id, path, bytes, sha256 }) => ({ id, path, bytes, sha256 })) }, null, 2));
