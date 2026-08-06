import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildConnecticutPrimaryJointReviewPackage } from "../src/ingestion/elections/connecticut-primary-identity-geography-review-package";

const sha=(value:Buffer)=>createHash("sha256").update(value).digest("hex");
async function main(){
  const [proposalJson,identityJson,geographyJson,sourceLockJson]=await Promise.all(["data/metadata/house-democratic-primary-source-selection-proposal-20260804-v1.json","data/metadata/connecticut-current-incumbent-nomination-linkage-candidate-v1.json","data/metadata/connecticut-primary-geography-compatibility-candidate-v1.json","data/source-lock.json"].map(path=>readFile(path,"utf8")));
  const value=buildConnecticutPrimaryJointReviewPackage({proposalJson,identityJson,geographyJson,sourceLockJson}),output="data/metadata/connecticut-primary-identity-geography-review-package-v1.json",bytes=Buffer.from(`${JSON.stringify(value,null,2)}\n`);try{await writeFile(output,bytes,{flag:"wx",mode:0o644});}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST"||!(await readFile(output)).equals(bytes))throw new Error("CONNECTICUT_PRIMARY_JOINT_REVIEW_OUTPUT_CONFLICT");}
  console.log(JSON.stringify({output,byteSize:bytes.length,sha256:sha(bytes),packageSha256:value.packageSha256,reviewRecordSetSha256:value.reviewRecordSetSha256,decisionSetSha256:value.decisionSetSha256,summary:value.summary},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
