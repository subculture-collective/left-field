import { readFile, writeFile } from "node:fs/promises";
import { buildMissouriPrimaryResultsV2 } from "@/rapid-acquisition/house-primary-missouri-results-v2";
const path = "data/metadata/rapid-house-primary-missouri-results-v2.json";
const bytes = Buffer.from(`${JSON.stringify(buildMissouriPrimaryResultsV2(), null, 2)}\n`);
writeFile(path, bytes, { flag: "wx" }).catch(async (error) => { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(path)).equals(bytes)) { process.stderr.write(`${error instanceof Error ? error.message : "MISSOURI_RESULTS_V2_GENERATION_FAILED"}\n`); process.exitCode = 1; } });
