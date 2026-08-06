import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources=[
  {cycleYear:2022,url:"https://portal.ct.gov/-/media/SOTS/ElectionServices/StatementOfVote_PDFs/SOV_2022.pdf",cacheName:"2022.pdf",output:"data/source/elections/general-results/connecticut/2022-statement-of-vote.pdf",byteSize:2290328,sha256:"1b6ca3708890241c387320e68b5e628f27a3bbc08b83b0d172e5d7bd9183664b"},
  {cycleYear:2024,url:"https://portal.ct.gov/-/media/sots/electionservices/statementofvote_pdfs/2024_statement_of_vote.pdf",cacheName:"2024.pdf",output:"data/source/elections/general-results/connecticut/2024-statement-of-vote.pdf",byteSize:3139465,sha256:"1043dc18895adcff95e227e136eb19ef1c65f2a452a4dc97105fb4738cf3751c"},
];
const hash=value=>createHash("sha256").update(value).digest("hex"),cache=process.env.DSA_SEATS_CT_GENERAL_STATEMENTS_CACHE_DIR;
if(process.env.DSA_SEATS_CT_GENERAL_STATEMENTS_DESCRIBE==="1"){
  process.stdout.write(`${JSON.stringify({verifiedSources:2,retainedSources:2,sources:sources.map(({cycleYear,byteSize,sha256})=>({cycleYear,byteSize,sha256}))})}\n`);process.exit(0);
}
for(const source of sources){
  const bytes=cache?await readFile(resolve(cache,source.cacheName)):Buffer.from(await(await fetch(source.url,{signal:AbortSignal.timeout(120000),headers:{"user-agent":"dsa-seats-source-lock/1.0"}})).arrayBuffer());
  if(bytes.length!==source.byteSize||hash(bytes)!==source.sha256)throw new Error(`CT_GENERAL_STATEMENT_SOURCE_DRIFT:${source.cycleYear}`);
  const target=resolve(source.output);await mkdir(dirname(target),{recursive:true});try{await writeFile(target,bytes,{flag:"wx",mode:0o644});}catch(error){if(error.code!=="EEXIST"||!(await readFile(target)).equals(bytes))throw new Error(`CT_GENERAL_STATEMENT_OUTPUT_CONFLICT:${source.cycleYear}`);}
}
process.stdout.write(`${JSON.stringify({verifiedSources:2,retainedSources:2})}\n`);
