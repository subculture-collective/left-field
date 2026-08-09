import { readFile, writeFile } from "node:fs/promises";
import { buildIndianaLocalOfficeResults } from "@/rapid-acquisition/indiana-local-office-results";
const path = "data/metadata/rapid-indiana-local-office-primary-results-v1.json";
async function main() { const bytes = Buffer.from(`${JSON.stringify(buildIndianaLocalOfficeResults(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "INDIANA_LOCAL_OFFICE_GENERATION_FAILED"}\n`); process.exitCode = 1; });
