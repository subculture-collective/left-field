import { readFile, writeFile } from "node:fs/promises";
import { buildMississippiPrimaryResults } from "@/rapid-acquisition/house-primary-mississippi-results";
const path = "data/metadata/rapid-house-primary-mississippi-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildMississippiPrimaryResults(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "MISSISSIPPI_RESULTS_GENERATION_FAILED"}\n`); process.exitCode = 1; });
