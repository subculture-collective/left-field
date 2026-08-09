import { readFile, writeFile } from "node:fs/promises";
import { buildAlabamaPrimaryResults } from "@/rapid-acquisition/house-primary-alabama-results";

const path = "data/metadata/rapid-house-primary-alabama-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildAlabamaPrimaryResults(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "ALABAMA_RESULTS_GENERATION_FAILED"}\n`); process.exitCode = 1; });
