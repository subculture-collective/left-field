import { readFile, writeFile } from "node:fs/promises";

import { buildCountyDemographicsProjection } from "@/rapid-acquisition/county-demographics";

const path = "data/metadata/rapid-county-demographics-projection-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildCountyDemographicsProjection(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "COUNTY_DEMOGRAPHICS_GENERATION_FAILED"}\n`); process.exitCode = 1; });
