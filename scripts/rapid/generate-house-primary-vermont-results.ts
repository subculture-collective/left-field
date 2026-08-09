import { readFile, writeFile } from "node:fs/promises";
import { buildVermontPrimaryResults } from "@/rapid-acquisition/house-primary-vermont-results";
const path = "data/metadata/rapid-house-primary-vermont-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildVermontPrimaryResults(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "VERMONT_RESULTS_GENERATION_FAILED"}\n`); process.exitCode = 1; });
