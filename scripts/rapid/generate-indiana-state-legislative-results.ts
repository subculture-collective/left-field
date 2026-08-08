import { readFile, writeFile } from "node:fs/promises";

import { buildIndianaStateLegislativeResults } from "@/rapid-acquisition/indiana-state-legislative-results";

const path = "data/metadata/rapid-indiana-state-legislative-primary-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildIndianaStateLegislativeResults(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "INDIANA_STATE_LEGISLATIVE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
