import { readFile } from "node:fs/promises";

import { retainRapidSource } from "./retain-source";

const COMMIT = "df531089c78e6d0098db1a6bfb3849a066a06995";
const STATES = "ak al ar az ca co ct dc de fl ga hi ia id il in ks ky la ma md me mi mn mo ms mt nc nd ne nh nj nm nv ny oh ok or pa ri sc sd tn tx ut va vt wa wi wv wy".split(" ");

async function main() {
  const sourceLockBytes = await readFile("data/source-lock.json"), lock = JSON.parse(sourceLockBytes.toString("utf8")) as { entries: readonly { id: string; byteSize?: number; sha256?: string }[] };
  const results = [];
  for (const state of STATES) {
    const sourceId = `medsl-2024-house-state-${state}`, entry = lock.entries.find((item) => item.id === sourceId);
    if (!entry || !Number.isSafeInteger(entry.byteSize) || typeof entry.sha256 !== "string") throw new Error(`COUNTY_HOUSE_SOURCE_PIN_MISSING:${state}`);
    results.push(await retainRapidSource({ sourceId, url: `https://raw.githubusercontent.com/MEDSL/2024-elections-official/${COMMIT}/individual_states/${state}24.zip`, outputPath: `county-house-results/2024/${state}24.zip`, expectedBytes: entry.byteSize, expectedSha256: entry.sha256, sourceLockBytes }));
  }
  process.stdout.write(`${JSON.stringify({ sources: results.length, retained: results.filter((row) => row.status === "retained").length, alreadyRetained: results.filter((row) => row.status === "already_retained").length })}\n`);
}

if (require.main === module) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "COUNTY_HOUSE_RESULTS_ACQUISITION_FAILED"}\n`); process.exitCode = 1; });
