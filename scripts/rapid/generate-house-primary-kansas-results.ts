import { readFile, writeFile } from "node:fs/promises";
import { buildKansasPrimaryResults } from "@/rapid-acquisition/house-primary-kansas-results";
const output = "data/metadata/rapid-house-primary-kansas-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildKansasPrimaryResults(), null, 2)}\n`); try { await writeFile(output, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "KANSAS_RESULTS_GENERATION_FAILED"}\n`); process.exitCode = 1; });
