import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAipacIncumbentResolutionDispositionsV2 } from "../src/ingestion/fec/aipac-incumbent-resolution-dispositions-v2";

async function main(): Promise<void> {
  const input = resolve("data/metadata/aipac-incumbent-conflict-resolution-candidate-v1.json"), output = resolve("data/metadata/aipac-incumbent-resolution-dispositions-v2.json");
  const bytes = await readFile(input), value = buildAipacIncumbentResolutionDispositionsV2({ parent: JSON.parse(bytes.toString("utf8")), parentFileSha256: createHash("sha256").update(bytes).digest("hex") });
  const encoded = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, encoded, { flag: "wx", mode: 0o644 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(encoded)) throw new Error("AIPAC_INCUMBENT_DISPOSITIONS_V2_OUTPUT_CONFLICT"); }
  process.stdout.write(`${JSON.stringify({ output, summary: value.summary, packageSha256: value.packageSha256 }, null, 2)}\n`);
}
main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "AIPAC_INCUMBENT_DISPOSITIONS_V2_GENERATION_FAILED"}\n`); process.exitCode = 1; });
