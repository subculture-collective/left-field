import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const source = { id: "tiger-cd118-35", url: "https://www2.census.gov/geo/tiger/TIGER2022/CD/tl_2022_35_cd118.zip", path: "data/source/tiger2022/tl_2022_35_cd118.zip", bytes: 621463, sha256: "88d8b5566cee6778eceb0809ae84165eac6db2a50653ee36df831791d241bc1b" };
const sha = (value) => createHash("sha256").update(value).digest("hex");
const response = await fetch(source.url, { redirect: "follow", signal: AbortSignal.timeout(60_000), headers: { "user-agent": "dsa-seats factual source acquisition contact=admin@dsaslate.us" } });
if (!response.ok) throw new Error(`NM_GEOGRAPHY_FETCH_HTTP:${response.status}`);
const value = Buffer.from(await response.arrayBuffer()); if (value.length !== source.bytes || sha(value) !== source.sha256) throw new Error("NM_GEOGRAPHY_FETCH_DRIFT"); await mkdir(dirname(source.path), { recursive: true });
try { await writeFile(source.path, value, { flag: "wx", mode: 0o644 }); } catch (error) { if (error.code !== "EEXIST" || !(await readFile(source.path)).equals(value)) throw new Error("NM_GEOGRAPHY_FETCH_OUTPUT_CONFLICT"); }
console.log(JSON.stringify(source, null, 2));
