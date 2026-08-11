import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type HousePrimaryCoverageLedgerV11,
  type HousePrimaryProjectionV11,
  validateHousePrimaryProjectionV11,
} from "./house-primary-projection-v11";
import { validateSouthCarolinaPrimaryResultsV2 } from "./house-primary-south-carolina-results-v2";
import { byteCompare, canonical, hash, sha, exact } from "./shared";

export interface HousePrimaryProjectionV12 {
  readonly schema: "rapid-house-primary-projection-v12";
  readonly version: 12;
  readonly parentProjectionPackageSha256: string;
  readonly southCarolinaResultsV2PackageSha256: string;
  readonly observations: HousePrimaryProjectionV11["observations"];
  readonly observationSetSha256: string;
  readonly coverageRows: HousePrimaryProjectionV11["coverageRows"];
  readonly coverageSetSha256: string;
  readonly summary: Readonly<{
    stateCycles: 48;
    districtObservations: 78;
    reportedContests: 27;
    sourceAbsent: 3;
    processedDistricts: 30;
    candidateRows: 73;
    retainedCandidateVotes: 1_676_503;
    sourceMarkedWinnerContests: 6;
    scoreEligibleDistricts: 0;
  }>;
  readonly packageSha256: string;
}

export interface HousePrimaryCoverageLedgerV12 extends Omit<HousePrimaryCoverageLedgerV11,"schema"|"version"|"projectionSha256"> {
  readonly schema: "rapid-house-primary-coverage-ledger-v12";
  readonly version: 12;
  readonly projectionSha256: string;
}

export function buildHousePrimaryProjectionV12(root=process.cwd()):HousePrimaryProjectionV12 {
  const parent=validateHousePrimaryProjectionV11(JSON.parse(readFileSync(join(root,"data/metadata/rapid-house-primary-projection-v11.json"),"utf8")),root);
  const southCarolina=validateSouthCarolinaPrimaryResultsV2(JSON.parse(readFileSync(join(root,"data/metadata/rapid-house-primary-south-carolina-results-v2.json"),"utf8")),root);
  const absence=southCarolina.sourceAbsences[0];
  if(!absence)throw new Error("HOUSE_PRIMARY_V12_SC_ABSENCE_MISSING");
  const observations: HousePrimaryProjectionV11["observations"] = parent.observations.map(row=>row.observationId!=="sc:primary:2024:06"?row:{...row,parseStatus:"source_absent" as const,missingReason:absence.status,sourceLockIds:absence.sourceLockIds,sourceContestId:null,candidateCount:null,votes:null,sourceWinnerStatus:null,resultAuthorityStatus:null,winner:null,identity:null,scoreEligible:false as const});
  const coverageRows=parent.coverageRows.map(row=>row.stateCode!=="SC"||row.cycleYear!==2024?row:{...row,retainedArtifactCount:2,parsedDistrictCount:0,sourceAbsentDistrictCount:1,status:"source_absent" as const,missingByReason:[{reason:"source_absent_no_disposition_inference",count:1}],artifactLockIds:["sc-2024-primary-enr","sc-2024-house-primary-event-search"]});
  const reportedContests=observations.filter(row=>row.parseStatus==="parsed").length;
  const sourceAbsent=observations.filter(row=>row.parseStatus==="source_absent").length;
  const retainedCandidateVotes=observations.reduce((sum,row)=>sum+(row.votes??0),0);
  const sourceMarkedWinnerContests=observations.filter(row=>row.sourceWinnerStatus==="marked_by_source").length;
  if(observations.length!==78||coverageRows.length!==48||reportedContests!==27||sourceAbsent!==3||retainedCandidateVotes!==1_676_503||sourceMarkedWinnerContests!==6||observations.some(row=>row.scoreEligible||row.winner!==null||row.identity!==null))throw new Error("HOUSE_PRIMARY_V12_CLOSURE_INVALID");
  const observationSetSha256=hash("dsa-seats:rapid-house-primary-v12-observation-set:v1",observations),coverageSetSha256=hash("dsa-seats:rapid-house-primary-v12-coverage-set:v1",coverageRows);
  const summary={stateCycles:48 as const,districtObservations:78 as const,reportedContests:27 as const,sourceAbsent:3 as const,processedDistricts:30 as const,candidateRows:73 as const,retainedCandidateVotes:1_676_503 as const,sourceMarkedWinnerContests:6 as const,scoreEligibleDistricts:0 as const};
  const unsigned={schema:"rapid-house-primary-projection-v12" as const,version:12 as const,parentProjectionPackageSha256:parent.packageSha256,southCarolinaResultsV2PackageSha256:southCarolina.packageSha256,observations,observationSetSha256,coverageRows,coverageSetSha256,summary};
  return{...unsigned,packageSha256:hash("dsa-seats:rapid-house-primary-v12-package:v1",unsigned)};
}

export function validateHousePrimaryProjectionV12(value:unknown,root=process.cwd()):HousePrimaryProjectionV12{const expected=buildHousePrimaryProjectionV12(root);if(!exact(value,expected))throw new Error("HOUSE_PRIMARY_PROJECTION_V12_INVALID");return value as HousePrimaryProjectionV12;}
export function buildHousePrimaryCoverageLedgerV12(projection=buildHousePrimaryProjectionV12()):HousePrimaryCoverageLedgerV12{const rowSetSha256=hash("dsa-seats:rapid-house-primary-v12-ledger-row-set:v1",projection.coverageRows),unsigned={schema:"rapid-house-primary-coverage-ledger-v12" as const,version:12 as const,projectionSha256:projection.packageSha256,rows:projection.coverageRows,rowSetSha256};return{...unsigned,packageSha256:hash("dsa-seats:rapid-house-primary-v12-ledger-package:v1",unsigned)}}
export function validateHousePrimaryCoverageLedgerV12(value:unknown,projection=buildHousePrimaryProjectionV12()):HousePrimaryCoverageLedgerV12{const expected=buildHousePrimaryCoverageLedgerV12(projection);if(!exact(value,expected))throw new Error("HOUSE_PRIMARY_COVERAGE_LEDGER_V12_INVALID");return value as HousePrimaryCoverageLedgerV12;}
