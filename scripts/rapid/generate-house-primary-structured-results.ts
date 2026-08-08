import { readFile, writeFile } from "node:fs/promises";

import { buildStructuredPrimaryResults } from "@/rapid-acquisition/house-primary-structured-results";

const output = "data/metadata/rapid-house-primary-structured-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildStructuredPrimaryResults(), null, 2)}\n`); try { await writeFile(output, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "STRUCTURED_PRIMARY_GENERATION_FAILED"}\n`); process.exitCode = 1; });
