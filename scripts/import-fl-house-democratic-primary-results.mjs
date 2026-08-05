import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceDirectory=process.env.FL_PRIMARY_IMPORT_DIR;
if(!sourceDirectory)throw new Error("FL_PRIMARY_IMPORT_DIR_REQUIRED");
const files=[
 ["fl-extract-8-23-2022.body","data/source/elections/primary-results/florida/2022/official-results-extract.tsv",169231,"6090922baca4e8648ac2f963423eafe464ddda17f88f203461c4bfd87e2ec418",["ElectionDate\tPartyCode","United States Representative"]],
 ["fl-download-8-23-2022.body","data/source/elections/primary-results/florida/2022/official-results-download.html",9225,"6bf32a63f5f787fc2cbf66edd27ecd1103300909d976085b9a025a05c749f01b",["OfficialResults\" VALUE=\"Y","August 23, 2022 Primary Election"]],
 ["fl-extract-8-20-2024.body","data/source/elections/primary-results/florida/2024/official-results-extract.tsv",96674,"228b0bec5995773272ced4ec5e73ec624483aa75e9bb13883382ff6eece8e2dd",["ElectionDate\tPartyCode","United States Representative"]],
 ["fl-download-8-20-2024.body","data/source/elections/primary-results/florida/2024/official-results-download.html",9225,"c2620055bdd32150252f5c1e1ef5f65ceb25d7a8c69fce973f1349a7ac324b57",["OfficialResults\" VALUE=\"Y","August 20, 2024 Primary Election"]],
 ["fl-election-results-archive.html","data/source/elections/primary-results/florida/authority/results-archive-20260805.html",25178,"0e5e0e3a06453c20109deec173032557d9aec5961f32847a1207b9db9a8dfbaa",["Election Results Archive","current and past election results data"]],
 ["fl-election-dates.html","data/source/elections/primary-results/florida/authority/election-dates-20260805.html",30878,"eb904f9565378783bd9bf6c5ae528fa521863816a6b60ba246929a2e179d2951",["Primary Election 2026","August 18, 2026","election-results-reporting-timeline-pe-2026"]],
 ["fl-2026-primary-reporting-timeline.pdf","data/source/elections/primary-results/florida/authority/2026-primary-results-reporting-timeline.pdf",175344,"ed5ecaca43ef9907b607db980fbf4bb2132e5f19ca58fb562f8598cfbc05a51f",["%PDF"]],
 ["fl-2026-primary-reporting-timeline.txt","data/source/elections/primary-results/florida/authority/2026-primary-results-reporting-timeline.txt",4841,"77eb2f53e269c737ce469df060a943db3490d6a4abc907ed0d2f03f96916c08c",["Aug. 18","Aug. 27","Certifies"]],
];
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
for(const [name,path,size,sha256,phrases] of files){const source=resolve(sourceDirectory,name),bytes=await readFile(source);if(bytes.length!==size||hash(bytes)!==sha256)throw new Error(`FL_PRIMARY_SOURCE_BYTES_INVALID: ${name}`);const text=bytes.toString("latin1");if(phrases.some(phrase=>!text.includes(phrase)))throw new Error(`FL_PRIMARY_SOURCE_SCOPE_INVALID: ${name}`);await mkdir(dirname(path),{recursive:true});await copyFile(source,path)}
console.log(JSON.stringify({imported:files.length,sourceDirectory},null,2));
