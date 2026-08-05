import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDirectory = process.env.MI_PRIMARY_IMPORT_DIR;
if (!sourceDirectory) {
  throw new Error("MI_PRIMARY_IMPORT_DIR_REQUIRED: provide the exact browser capture and official Michigan source bundle");
}

const files = [
  ["2022-official-results-browser.json", "data/source/elections/primary-results/michigan/2022/official-results-browser.json", 7798, "3616cfc7cf96a7c56badf36f53a080ca43549a72e58d5c3c21d7532eabfeb813", ["browser_rendered_official_results", "83", "OFFICIAL", "LORINSER, BOB"]],
  ["2022-certification.html", "data/source/elections/primary-results/michigan/2022/board-certification-20220819.html", 363123, "7e70d9c9a00b4422639a29297ad604aef24027ddf4febeef94e932c5e295ba7b", ["unanimously voted to certify the August primary elections", "state&rsquo;s 83 counties"]],
  ["2024-official-results-browser.json", "data/source/elections/primary-results/michigan/2024/official-results-browser.json", 6861, "e9a469840c98f9a583e4ad599c9fa5ba52b0a4ea0b32aada1857ce204d6d49ee", ["browser_rendered_official_results", "83", "OFFICIAL", "MCDONALD RIVET, KRISTEN"]],
  ["2024-signed-minutes.pdf", "data/source/elections/primary-results/michigan/2024/board-signed-minutes-20240826.pdf", 78686, "bafbce4fa43b6d6dd9e4070dbd37e16c3a62ed22293c05441bb5d885c1d8aaa1", ["%PDF"]],
  ["2024-signed-minutes.txt", "data/source/elections/primary-results/michigan/2024/board-signed-minutes-20240826.txt", 4984, "58595e6c8652e5d81f0123082de99cd356e8e6432ac3f3da435b2405f954b3f0", ["Canvass and certification of the August 6, 2024 primary election", "true statement of the votes"]],
  ["2026-unofficial-boundary-browser.json", "data/source/elections/primary-results/michigan/2026/unofficial-boundary-browser-20260805.json", 651, "a570693f064ff1d6f422d77f9731ebd3c746ac2aad08972d939febb54dc4da5c", ["UNOFFICIAL", "82", "retainedResultRows", "unofficial_results_not_retained_pending_county_and_state_canvass"]],
  ["2026-election-dates.pdf", "data/source/elections/primary-results/michigan/authority/2026-election-dates.pdf", 2378428, "865ddeb9d94fd700ebb3a0b7f0ed180e0a23a3d1cc40e5a72dfc585ac3062f74", ["%PDF"]],
  ["2026-election-dates.txt", "data/source/elections/primary-results/michigan/authority/2026-election-dates.txt", 63723, "d53be9da0af24e1e7e59e3dd9745331378f5a87f4b8f1c72d2d6a1b4a00b4f7e", ["Tuesday, Aug. 18, 2026", "Monday, Aug. 24, 2026"]],
  ["results-catalog.html", "data/source/elections/primary-results/michigan/authority/results-catalog-20260805.html", 421271, "0930816d6ca5105737b7f188160570ea436b4555ee868af4783fdfa1f125aa00", ["electionDate=8-2-2022", "electionDate=8-6-2024", "electionDate=8-4-2026"]],
  ["canvass-certification-authority.html", "data/source/elections/primary-results/michigan/authority/canvass-certification-authority-20260805.html", 440181, "d5cfba8c05a6dcb6f5631cabb5bebfbd67a7ae791b7d23115cc8e37a2fa9389f", ["correct any errors before certifying the election and making results official", "This is done before results are certified"]],
];

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const [sourceName, retainedPath, byteSize, sha256, phrases] of files) {
  const sourcePath = resolve(sourceDirectory, sourceName);
  const bytes = await readFile(sourcePath);
  if (bytes.length !== byteSize || hash(bytes) !== sha256) {
    throw new Error(`MI_PRIMARY_SOURCE_BYTES_INVALID: ${sourceName}`);
  }
  const text = bytes.toString("utf8");
  if (phrases.some((phrase) => !text.includes(phrase))) {
    throw new Error(`MI_PRIMARY_SOURCE_SCOPE_INVALID: ${sourceName}`);
  }
  await mkdir(dirname(retainedPath), { recursive: true });
  await copyFile(sourcePath, retainedPath);
}

console.log(JSON.stringify({ imported: files.length, sourceDirectory }, null, 2));
