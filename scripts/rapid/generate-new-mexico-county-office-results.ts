import { readFile, writeFile } from "node:fs/promises";
import { buildNewMexicoCountyOfficeResults } from "@/rapid-acquisition/new-mexico-county-office-results";
const path = "data/metadata/rapid-new-mexico-county-office-primary-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildNewMexicoCountyOfficeResults(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "NEW_MEXICO_COUNTY_OFFICE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
