import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDirectory = process.env.MN_PRIMARY_IMPORT_DIR;
if (!sourceDirectory) throw new Error("MN_PRIMARY_IMPORT_DIR_REQUIRED");

const sources = [
  ["mn-2022-primary-landing.html", "data/source/elections/primary-results/minnesota/2022/primary-results-landing.html", 48249, "f3716b13db01774eb41381b1360328e8172b76a75ca750af5908463643ef14e5"],
  ["mn-2022-media-index.html", "data/source/elections/primary-results/minnesota/2022/media-files-index.html", 43665, "e9cd60975a5faee9637494482c7d1fd11f8cb0ff85376cc45186d5bce0630a83"],
  ["mn-2022-ushouse.txt", "data/source/elections/primary-results/minnesota/2022/ushouse.txt", 2726, "cdb828e50c2b6ef6a9c2b19a828970dab7b181571d77e39b40ca629cae74ac9a"],
  ["mn-2022-candidates.txt", "data/source/elections/primary-results/minnesota/2022/candidates.txt", 31840, "e3f73c12d1eee3a56633d0999861f00fb7525ce7b50bd19b467aadac7f416477"],
  ["mn-2022-state-canvass-document.html", "data/source/elections/primary-results/minnesota/2022/state-canvass-document-record.html", 34669, "d8fa8a9efc539bd76ba5a54fc53bda005c3b46b46bfe0601c5e4911eb0914483"],
  ["mn-2024-primary-landing.html", "data/source/elections/primary-results/minnesota/2024/primary-results-landing.html", 45890, "750b071f8045fbe17abddb1c0cff9cc3805453ff3448886a3c62ba9cdbfbe87e"],
  ["mn-2024-ushouse.txt", "data/source/elections/primary-results/minnesota/2024/ushouse.txt", 2530, "4deba4991ea309c037dd7306116d5c587ffea82172bc8f9d82f7e1a51c365769"],
  ["mn-2024-candidates.txt", "data/source/elections/primary-results/minnesota/2024/candidates.txt", 15720, "92b27af5693ee63f73bfacbf9840b5ecfd8b3c3848f56dd88ce1fc90f3864992"],
  ["mn-2024-media-file-layout.html", "data/source/elections/primary-results/minnesota/2024/media-file-layout.html", 6428, "9643903869d1f1e684117c2d85906bf2ba649113c23c0a983d26e92ae9dc3ff3"],
  ["mn-2024-state-canvass-document.html", "data/source/elections/primary-results/minnesota/2024/state-canvass-document-record.html", 34482, "96fb7c18a340c0eaccde3af20efbda923fa04019cc9c772f82302778c7962613"],
  ["mn-statute-204d03.html", "data/source/elections/primary-results/minnesota/authority/statute-204d03.html", 64332, "884f7e79e27a1ec451527ee7a298cc8802406fa9d0d9ca7437623dd2bb1e165d"],
];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const acquired = [];
for (const [inputName, retainedPath, byteSize, sha256] of sources) {
  const bytes = await readFile(resolve(sourceDirectory, inputName));
  if (bytes.length !== byteSize || hash(bytes) !== sha256) throw new Error(`MN_PRIMARY_SOURCE_DRIFT:${inputName}`);
  acquired.push({ retainedPath, bytes });
}
for (const { retainedPath, bytes } of acquired) {
  const output = resolve(retainedPath); await mkdir(dirname(output), { recursive: true });
  try { await writeFile(output, bytes, { flag: "wx", mode: 0o644 }); }
  catch (error) { if (error?.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`MN_PRIMARY_OUTPUT_CONFLICT:${retainedPath}`); }
}
process.stdout.write(`${JSON.stringify({ importedSources: sources.length, sourceCutoff: "2026-08-06", lifecycle: "retained_reviewer_only_not_published" })}\n`);
