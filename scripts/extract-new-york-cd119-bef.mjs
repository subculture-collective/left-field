import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const bundlePath = resolve(process.env.DSA_SEATS_NY_CD119_BEF_BUNDLE_PATH ?? "data/source/elections/primary-results/geography/north-carolina/current/census-cd119-block-equivalency-bundle.zip");
const output = resolve("data/source/elections/primary-results/geography/new-york/current/36_NY_CD119.txt");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const bundle = await readFile(bundlePath);
if (bundle.length !== 22959130 || sha(bundle) !== "1433feb5178dc7b4188ee30f5f7f715851f4400740b8fe1ce606a876c6294bd6") throw new Error("NY_CD119_BEF_PARENT_DRIFT");
const bytes = execFileSync("unzip", ["-p", bundlePath, "36_NY_CD119.txt"], { maxBuffer: 8 * 1024 * 1024 });
if (bytes.length !== 5776392 || sha(bytes) !== "670447571d72c0465cd27ac9769c2e969669d7decb06a4198c653b755ff2e46a") throw new Error("NY_CD119_BEF_MEMBER_DRIFT");
if (process.env.DSA_SEATS_NY_CD119_BEF_DESCRIBE === "1") { process.stdout.write(`${JSON.stringify({ member: "36_NY_CD119.txt", byteSize: bytes.length, sha256: sha(bytes), records: 288819 })}\n`); process.exit(0); }
await mkdir(dirname(output), { recursive: true });
try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
catch (error) { if (error.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("NY_CD119_BEF_OUTPUT_CONFLICT"); }
process.stdout.write(`${JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes) })}\n`);
