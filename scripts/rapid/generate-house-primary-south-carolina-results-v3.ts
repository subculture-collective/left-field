import { readFile, writeFile } from "node:fs/promises";
import { buildSouthCarolinaPrimaryResultsV3 } from "@/rapid-acquisition/house-primary-south-carolina-results-v3";
const path="data/metadata/rapid-house-primary-south-carolina-results-v3.json";
async function main(){const bytes=Buffer.from(`${JSON.stringify(buildSouthCarolinaPrimaryResultsV3(),null,2)}\n`);try{await writeFile(path,bytes,{flag:"wx"})}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST"||!(await readFile(path)).equals(bytes))throw error}}
main().catch((error)=>{process.stderr.write(`${error instanceof Error?error.message:"SOUTH_CAROLINA_RESULTS_V3_GENERATION_FAILED"}\n`);process.exitCode=1});
