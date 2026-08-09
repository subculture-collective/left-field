import { readFile, writeFile } from "node:fs/promises";
import { buildNewHampshirePrimaryResultsV2 } from "@/rapid-acquisition/house-primary-new-hampshire-results-v2";

const path="data/metadata/rapid-house-primary-new-hampshire-results-v2.json",bytes=Buffer.from(`${JSON.stringify(buildNewHampshirePrimaryResultsV2(),null,2)}\n`);
writeFile(path,bytes,{flag:"wx"}).catch(async(error)=>{if((error as NodeJS.ErrnoException).code!=="EEXIST"||!(await readFile(path)).equals(bytes)){process.stderr.write(`${error instanceof Error?error.message:"NEW_HAMPSHIRE_RESULTS_V2_GENERATION_FAILED"}\n`);process.exitCode=1;}});
