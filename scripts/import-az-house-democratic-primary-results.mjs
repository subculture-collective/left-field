import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDirectory = process.env.AZ_PRIMARY_IMPORT_DIR;
if (!sourceDirectory) throw new Error("AZ_PRIMARY_IMPORT_DIR_REQUIRED: import the exact browser-captured official files; the Arizona host rejects unattended command-line retrieval");

const files = [
  ["2022.pdf","data/source/elections/primary-results/arizona/2022/official-statewide-canvass.pdf",424264,"71ea40f491477963a3253df9b2fcc1c724b16f6b4d261747bf0e5c5a7ffdd09d"],
  ["2022.txt","data/source/elections/primary-results/arizona/2022/official-statewide-canvass.txt",80796,"f603c129861b6bcc1c4512f5f73564066bf338ea21cbf297d4c0eb642a275610"],
  ["2024.pdf","data/source/elections/primary-results/arizona/2024/official-statewide-canvass.pdf",424021,"cd1965a958a81709e37b4d47aca3662ba1cab58066eec5bee08eaefbd763b172"],
  ["2024-ocr-stable.txt","data/source/elections/primary-results/arizona/2024/official-statewide-canvass-ocr.txt",95916,"de2aea5dd1c8e2a2dfbe8e42744c22a3d1a4bb5fad2e7618d946f864ce090825"],
  ["2024-cd03-recount-report.pdf","data/source/elections/primary-results/arizona/2024/cd03-recount-report.pdf",224274,"e24e00a9d042a83393c430a2352ee5c7b1678dc5efa31b6067a374e39ea46341"],
  ["2024-cd03-recount-report-ocr-stable.txt","data/source/elections/primary-results/arizona/2024/cd03-recount-report-ocr.txt",12587,"d5dda7b182e97b98604b7624838b0028126775b71574af58961a7575833eb6d9"],
  ["2024-cd03-court-order.pdf","data/source/elections/primary-results/arizona/2024/cd03-court-order.pdf",580892,"8815120061fcffe445e90f6675d7ea6ea755bb13bbbde9449bb52f2115b631e0"],
  ["2024-cd03-court-order-ocr-stable.txt","data/source/elections/primary-results/arizona/2024/cd03-court-order-ocr.txt",2981,"e47340113ae479a19ed05c51f552e280924d9e10d5240c02633cf51bde355924"],
  ["2026-election-info.html","data/source/elections/primary-results/arizona/2026/election-info-20260805.html",281839,"0fbd87e399a923ad01a6913f2776eceb66eb41c491d34c51dfefdf9e246ed11d"],
  ["post-election-procedures.html","data/source/elections/primary-results/arizona/authority/post-election-procedures-20260805.html",289147,"411cc5d0199ddee6e50da4a66b2145cb5dc2e5716dcd978ea3adde2daa66ec15"],
];
const hash = value => createHash("sha256").update(value).digest("hex");
for (const [inputName, retainedPath, byteSize, sha256] of files) {
  const bytes = await readFile(resolve(sourceDirectory, inputName));
  if (bytes.length !== byteSize || hash(bytes) !== sha256) throw new Error(`AZ_PRIMARY_BYTES_INVALID:${inputName}`);
  const output = resolve(retainedPath); await mkdir(dirname(output), { recursive:true });
  try { await writeFile(output, bytes, { flag:"wx", mode:0o644 }); }
  catch (error) { if (error.code !== "EEXIST" || !(await readFile(output)).equals(bytes)) throw new Error(`AZ_PRIMARY_OUTPUT_CONFLICT:${retainedPath}`); }
}
const transcription=Buffer.from("Arizona 2024 Democratic U.S. House District 3 final recount table\nSource: az-2024-cd03-primary-recount-report-pdf, page 7\nYassamin Ansari\t19087\nRaquel Terán\t19048\nDuane M. Wooten\t4686\nWrite-in (aggregate)\t93\nTotal Votes\t42914\n");
const transcriptionPath=resolve("data/source/elections/primary-results/arizona/2024/cd03-final-recount-table.txt");
if(transcription.length!==227||hash(transcription)!=="c5e267eeeae83b8f45af1b2d3987d806609d9e2d2afb2438ee3c482a459396c7")throw new Error("AZ_PRIMARY_TRANSCRIPTION_INVALID");
await mkdir(dirname(transcriptionPath),{recursive:true});try{await writeFile(transcriptionPath,transcription,{flag:"wx",mode:0o644})}catch(error){if(error.code!=="EEXIST"||!(await readFile(transcriptionPath)).equals(transcription))throw new Error("AZ_PRIMARY_OUTPUT_CONFLICT:cd03-final-recount-table.txt")}
process.stdout.write(`${JSON.stringify({ imported:files.length, derivedTranscriptions:1, sourceCutoff:"2026-08-05", lifecycle:"retained_not_reviewed_or_published" })}\n`);
