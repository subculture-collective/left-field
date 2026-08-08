import { readFile, writeFile } from "node:fs/promises";

import { buildAtLargeCd119CountyUniverse } from "@/rapid-acquisition/at-large-cd119-county-universe";

const output = "data/metadata/rapid-at-large-cd119-county-universe-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildAtLargeCd119CountyUniverse(), null, 2)}\n`); try { await writeFile(output, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "AT_LARGE_CD119_GENERATION_FAILED"}\n`); process.exitCode = 1; });
