import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildOregonPrimaryReceipt } from "../src/ingestion/elections/oregon-house-democratic-primary-results-receipt";

type Entry={id:string;url:string;retainedPath?:string;retainedStatus:string;byteSize:number;sha256:string;kind:string;parentIds:string[]};
const ids=new Set(["or-2022-primary-official-abstract-pdf","or-2022-primary-official-abstract-text","or-2024-primary-official-abstract-pdf","or-2024-primary-official-abstract-text","or-2026-primary-official-abstract-pdf","or-2026-primary-official-abstract-text"]);
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");

async function main(){
  const lock=JSON.parse(await readFile("data/source-lock.json","utf8")) as{entries:Entry[]},entries=lock.entries.filter(entry=>ids.has(entry.id));
  if(entries.length!==ids.size)throw new Error("OR_PRIMARY_LOCK_CLOSURE_INVALID");
  const inputs=await Promise.all(entries.map(async entry=>{if(!entry.retainedPath||entry.retainedStatus!=="retained")throw new Error("OR_PRIMARY_LOCK_INVALID");const bytes=await readFile(entry.retainedPath);if(bytes.length!==entry.byteSize||hash(bytes)!==entry.sha256)throw new Error("OR_PRIMARY_BYTES_INVALID");return{entry:{...entry,retainedPath:entry.retainedPath,retainedStatus:"retained" as const},bytes}}));
  const parentBytes=await readFile("data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json"),value=buildOregonPrimaryReceipt(inputs,{value:JSON.parse(parentBytes.toString("utf8")),fileSha256:hash(parentBytes)}),output=resolve("data/metadata/oregon-house-democratic-primary-results-2022-2026-v1.json"),bytes=Buffer.from(`${JSON.stringify(value,null,2)}\n`);
  try{await writeFile(output,bytes,{flag:"wx",mode:0o644})}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST"||!(await readFile(output)).equals(bytes))throw new Error("OR_PRIMARY_OUTPUT_CONFLICT")}
  console.log(JSON.stringify({output,byteSize:bytes.length,sha256:hash(bytes),packageSha256:value.packageSha256,summary:value.summary},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});
