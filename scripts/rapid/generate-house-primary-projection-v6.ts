import { readFile, writeFile } from "node:fs/promises";
import { buildHousePrimaryCoverageLedgerV6, buildHousePrimaryProjectionV6 } from "@/rapid-acquisition/house-primary-projection-v6";
const outputs = [["data/metadata/rapid-house-primary-projection-v6.json", () => buildHousePrimaryProjectionV6()], ["data/metadata/rapid-house-primary-coverage-ledger-v6.json", () => buildHousePrimaryCoverageLedgerV6()]] as const;
async function main() { for (const [path, build] of outputs) { const bytes = Buffer.from(`${JSON.stringify(build(), null, 2)}\n`); try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) throw error; } } }
if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "PROJECTION_V6_GENERATION_FAILED"}\n`); process.exitCode = 1; });
