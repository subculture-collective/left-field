import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateSouthCarolinaPrimaryResultsV3 } from "./house-primary-south-carolina-results-v3";
import {
  type HousePrimaryCoverageLedgerV20,
  type HousePrimaryProjectionV20,
  validateHousePrimaryProjectionV20,
} from "./house-primary-projection-v20";

type ParentObservation = HousePrimaryProjectionV20["observations"][number];
export type HousePrimaryV21Observation = Omit<ParentObservation,"resultAuthorityStatus"> & Readonly<{resultAuthorityStatus:ParentObservation["resultAuthorityStatus"]|"official_state_enr_current_result_retained"}>;
export interface HousePrimaryProjectionV21 {
  readonly schema:"rapid-house-primary-projection-v21"; readonly version:21;
  readonly parentProjectionPackageSha256:string; readonly southCarolinaResultsV3PackageSha256:string;
  readonly observations:readonly HousePrimaryV21Observation[]; readonly observationSetSha256:string;
  readonly coverageRows:HousePrimaryProjectionV20["coverageRows"]; readonly coverageSetSha256:string;
  readonly summary:Readonly<{stateCycles:48;districtObservations:78;reportedContests:39;sourceAbsent:4;processedDistricts:43;candidateRows:101;retainedCandidateVotes:2473779;sourceMarkedWinnerContests:9;scoreEligibleDistricts:0}>;
  readonly packageSha256:string;
}
export interface HousePrimaryCoverageLedgerV21 extends Omit<HousePrimaryCoverageLedgerV20,"schema"|"version"|"projectionSha256">{readonly schema:"rapid-house-primary-coverage-ledger-v21";readonly version:21;readonly projectionSha256:string}
const compare=(left:string,right:string)=>left<right?-1:left>right?1:0;
const canonical=(value:unknown):string=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?`[${value.map(canonical).join(",")}]`:`{${Object.keys(value as object).sort(compare).map((key)=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(",")}}`;
const hash=(domain:string,value:unknown)=>createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");
const exact=(left:unknown,right:unknown)=>canonical(left)===canonical(right);

export function buildHousePrimaryProjectionV21(root=process.cwd()):HousePrimaryProjectionV21{
  const parent=validateHousePrimaryProjectionV20(JSON.parse(readFileSync(join(root,"data/metadata/rapid-house-primary-projection-v20.json"),"utf8")),root);
  const southCarolina=validateSouthCarolinaPrimaryResultsV3(JSON.parse(readFileSync(join(root,"data/metadata/rapid-house-primary-south-carolina-results-v3.json"),"utf8")),root);
  const result=southCarolina.results.find((row)=>row.cycleYear===2026);
  if(!result) throw new Error("HOUSE_PRIMARY_V21_SOUTH_CAROLINA_RESULT_MISSING");
  const observations:HousePrimaryV21Observation[]=parent.observations.map((row)=>{
    if(row.observationId!=="sc:primary:2026:06") return row;
    if(row.parseStatus!=="source_blocked"||row.sourceLockIds.length!==0||row.districtLabel!==result.districtLabel) throw new Error("HOUSE_PRIMARY_V21_SOUTH_CAROLINA_PARENT_INVALID");
    return {...row,parseStatus:"parsed",missingReason:null,sourceLockIds:[...result.sourceLockIds],sourceContestId:result.resultId,candidateCount:result.sourceCandidateNames.length,votes:result.totalVotes,sourceWinnerStatus:result.sourceWinnerStatus,resultAuthorityStatus:result.resultAuthorityStatus};
  });
  const coverageRows=parent.coverageRows.map((row)=>row.stateCode!=="SC"||row.cycleYear!==2026?row:{...row,retainedArtifactCount:2,parsedDistrictCount:1,sourceAbsentDistrictCount:0,status:"parsed" as const,missingByReason:[],artifactLockIds:["sc-2026-primary-enr-election-settings","sc-2026-primary-enr-summary"]});
  const reported=observations.filter((row)=>row.parseStatus==="parsed").length,absent=observations.filter((row)=>row.parseStatus==="source_absent").length,votes=observations.reduce((sum,row)=>sum+(row.votes??0),0),marked=observations.filter((row)=>row.sourceWinnerStatus==="marked_by_source").length;
  if(reported!==39||absent!==4||votes!==2473779||marked!==9||observations.some((row)=>row.scoreEligible||row.winner!==null||row.identity!==null)) throw new Error("HOUSE_PRIMARY_V21_CLOSURE_INVALID");
  const observationSetSha256=hash("dsa-seats:rapid-house-primary-v21-observation-set:v1",observations),coverageSetSha256=hash("dsa-seats:rapid-house-primary-v21-coverage-set:v1",coverageRows);
  const summary={stateCycles:48 as const,districtObservations:78 as const,reportedContests:39 as const,sourceAbsent:4 as const,processedDistricts:43 as const,candidateRows:101 as const,retainedCandidateVotes:2473779 as const,sourceMarkedWinnerContests:9 as const,scoreEligibleDistricts:0 as const};
  const unsigned={schema:"rapid-house-primary-projection-v21" as const,version:21 as const,parentProjectionPackageSha256:parent.packageSha256,southCarolinaResultsV3PackageSha256:southCarolina.packageSha256,observations,observationSetSha256,coverageRows,coverageSetSha256,summary};
  return {...unsigned,packageSha256:hash("dsa-seats:rapid-house-primary-v21-package:v1",unsigned)};
}
export function validateHousePrimaryProjectionV21(value:unknown,root=process.cwd()):HousePrimaryProjectionV21{const expected=buildHousePrimaryProjectionV21(root);if(!exact(value,expected))throw new Error("HOUSE_PRIMARY_PROJECTION_V21_INVALID");return value as HousePrimaryProjectionV21}
export function buildHousePrimaryCoverageLedgerV21(projection=buildHousePrimaryProjectionV21()):HousePrimaryCoverageLedgerV21{const rowSetSha256=hash("dsa-seats:rapid-house-primary-v21-ledger-row-set:v1",projection.coverageRows);const unsigned={schema:"rapid-house-primary-coverage-ledger-v21" as const,version:21 as const,projectionSha256:projection.packageSha256,rows:projection.coverageRows,rowSetSha256};return {...unsigned,packageSha256:hash("dsa-seats:rapid-house-primary-v21-ledger-package:v1",unsigned)}}
