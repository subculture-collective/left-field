import { readFile, writeFile } from "node:fs/promises";

import { buildKentuckyPrimaryResults } from "@/rapid-acquisition/house-primary-kentucky-results";

const path = "data/metadata/rapid-house-primary-kentucky-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildKentuckyPrimaryResults(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "KENTUCKY_RESULTS_GENERATION_FAILED"}\n`); process.exitCode = 1; });
