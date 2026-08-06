import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildConnecticutNominationStatutoryAuthorityReceipt } from "../src/ingestion/elections/connecticut-nomination-statutory-authority-receipt";

const sha = (value: Buffer) => createHash("sha256").update(value).digest("hex");
async function main() {
  const [statute2021, supplement2022, statute2023, supplement2024, nominationReceiptBytes, sourceLockBytes] = await Promise.all([
    readFile("data/source/elections/primary-results/connecticut/statutes/2021-chapter-153.html"),
    readFile("data/source/elections/primary-results/connecticut/statutes/2022-chapter-153-supplement.html"),
    readFile("data/source/elections/primary-results/connecticut/statutes/2023-chapter-153.html"),
    readFile("data/source/elections/primary-results/connecticut/statutes/2024-chapter-153-supplement.html"),
    readFile("data/metadata/connecticut-primary-nomination-authority-receipt-v1.json"),
    readFile("data/source-lock.json"),
  ]);
  const value = buildConnecticutNominationStatutoryAuthorityReceipt({
    statute2021, statute2021Sha256: sha(statute2021), supplement2022, supplement2022Sha256: sha(supplement2022),
    statute2023, statute2023Sha256: sha(statute2023), supplement2024, supplement2024Sha256: sha(supplement2024),
    nominationReceiptBytes,
    sourceLock: JSON.parse(sourceLockBytes.toString("utf8")),
  });
  const output = "data/metadata/connecticut-nomination-statutory-authority-receipt-v1.json", bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error("CONNECTICUT_NOMINATION_STATUTORY_AUTHORITY_OUTPUT_CONFLICT"); }
  console.log(JSON.stringify({ output, byteSize: bytes.length, sha256: sha(bytes), packageSha256: value.packageSha256, cycleSetSha256: value.cycleSetSha256, summary: value.summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
