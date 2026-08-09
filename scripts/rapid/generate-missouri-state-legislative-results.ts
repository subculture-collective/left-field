import { readFile, writeFile } from "node:fs/promises";

import { buildMissouriStateLegislativeResults } from "@/rapid-acquisition/missouri-state-legislative-results";

const path = "data/metadata/rapid-missouri-state-legislative-primary-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildMissouriStateLegislativeResults(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "MISSOURI_STATE_LEGISLATIVE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
