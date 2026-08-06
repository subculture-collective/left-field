import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const url = "https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2023/118-congressional-district-bef/cd118.zip";
const bundlePath = resolve("data/source/elections/primary-results/geography/new-york/historical/census-cd118-block-equivalency-bundle.zip"), extractPath = resolve("data/source/elections/primary-results/geography/new-york/historical/36_NY_CD118.txt");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (process.env.DSA_SEATS_NY_CD118_BEF_DESCRIBE === "1") { process.stdout.write(`${JSON.stringify({ url, bundle: { byteSize: 25922515, sha256: "a2f38d0dd7c207fa144a88b66df9f59f8a6e5c27e932fbd4a32d1bcf587c5763" }, member: { name: "36_NY_CD118.txt", byteSize: 5776393, sha256: "359d8ec177dacf6511baf68c734a999ca9ff21ec4ef9897b85213838ed5c218a", records: 288819 } })}\n`); process.exit(0); }
const cachePath = process.env.DSA_SEATS_NY_CD118_BEF_CACHE_PATH;
const bundle = cachePath ? await readFile(resolve(cachePath)) : Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(120000), headers: { "user-agent": "dsa-seats-source-lock/1.0" } })).arrayBuffer());
if (bundle.length !== 25922515 || sha(bundle) !== "a2f38d0dd7c207fa144a88b66df9f59f8a6e5c27e932fbd4a32d1bcf587c5763") throw new Error("NY_CD118_BEF_BUNDLE_DRIFT");
await mkdir(dirname(bundlePath), { recursive: true });
try { await writeFile(bundlePath, bundle, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST" || !(await readFile(bundlePath)).equals(bundle)) throw new Error("NY_CD118_BEF_BUNDLE_OUTPUT_CONFLICT"); }
const member = execFileSync("unzip", ["-p", bundlePath, "36_NY_CD118.txt"], { maxBuffer: 8 * 1024 * 1024 });
if (member.length !== 5776393 || sha(member) !== "359d8ec177dacf6511baf68c734a999ca9ff21ec4ef9897b85213838ed5c218a") throw new Error("NY_CD118_BEF_MEMBER_DRIFT");
try { await writeFile(extractPath, member, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST" || !(await readFile(extractPath)).equals(member)) throw new Error("NY_CD118_BEF_MEMBER_OUTPUT_CONFLICT"); }
process.stdout.write(`${JSON.stringify({ bundlePath, extractPath, bundleSha256: sha(bundle), memberSha256: sha(member) })}\n`);
