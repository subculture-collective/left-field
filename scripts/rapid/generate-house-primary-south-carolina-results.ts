import { readFile, writeFile } from "node:fs/promises";
import { buildSouthCarolinaPrimaryResults } from "@/rapid-acquisition/house-primary-south-carolina-results";
async function main(){const path="data/metadata/rapid-house-primary-south-carolina-results-v1.json",bytes=Buffer.from(`${JSON.stringify(buildSouthCarolinaPrimaryResults(),null,2)}\n`);try{await writeFile(path,bytes,{flag:"wx"});}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST"||!(await readFile(path)).equals(bytes))throw error;}}
main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:"SOUTH_CAROLINA_RESULTS_GENERATION_FAILED"}\n`);process.exitCode=1;});
