import { readFile, writeFile } from "node:fs/promises";

import { buildRapidLocalContextCoverage } from "@/rapid-acquisition/local-context-coverage";

const path = "data/metadata/rapid-local-context-coverage-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildRapidLocalContextCoverage(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "RAPID_LOCAL_CONTEXT_COVERAGE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
