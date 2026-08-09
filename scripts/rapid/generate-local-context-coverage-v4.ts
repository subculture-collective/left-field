import { readFile, writeFile } from "node:fs/promises";

import { buildRapidLocalContextCoverageV4 } from "@/rapid-acquisition/local-context-coverage-v4";

const path = "data/metadata/rapid-local-context-coverage-v4.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildRapidLocalContextCoverageV4(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "RAPID_LOCAL_CONTEXT_COVERAGE_V4_GENERATION_FAILED"}\n`); process.exitCode = 1; });
