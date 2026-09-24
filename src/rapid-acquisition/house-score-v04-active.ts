import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { validateHouseScoreV04ShadowProjection } from "./house-score-v04-shadow";
import { byteCompare, hash, exact } from "./shared";

export type HouseScoreV04ActiveRow = Readonly<{
  seatCycleId: string;
  districtLabel: string;
  incumbentParty: "Democratic" | "Republican";
  qualifyingRoute: "deep_blue" | "aipac_supported_blue" | "republican_fringe_general";
  previousScoreVersion: "v0.3";
  previousScore: number;
  activeScoreVersion: "v0.4";
  activeScore: number;
  localContext: number | null;
  localContextAvailableWeight: number;
  exactGeographyJoin: "at_large_statewide" | "not_yet_eligible";
  movement: number;
  parentShadowRowSha256: string;
  rowSha256: string;
}>;

export type HouseScoreV04ActiveProjection = Readonly<{
  schema: "house-score-v04-active-projection-v1";
  version: 1;
  generatedAt: "2026-08-09T06:15:00.000Z";
  activationPolicy: Readonly<{
    status: "active";
    basis: "product_owner_directive_to_use_retained_county_context";
    scope: "exact_at_large_geography_only";
    missingBehavior: "preserve_v03_score_exactly";
    splitCountyAllocation: false;
    researchFallbackScoreInputs: false;
  }>;
  parent: Readonly<{ id: "house-score-v04-shadow-projection-v1"; fileSha256: string; packageSha256: string; rowSetSha256: string }>;
  rows: readonly HouseScoreV04ActiveRow[];
  summary: Readonly<{ seats: 430; localContextActiveSeats: 3; unchangedSeats: 427; routeChanges: 0; movementCapBreaches: 0 }>;
  rowSetSha256: string;
  packageSha256: string;
}>;

const SHADOW_PATH = "data/metadata/house-score-v04-shadow-projection-v1.json";
const SHADOW_SHA = "9f11120f810c8eebb5f1c13e069113e3cbfa965c5db4930f89ba698f13dbc80b";
const fileSha = (value: Buffer) => createHash("sha256").update(value).digest("hex");

export function buildHouseScoreV04ActiveProjection(root = process.cwd()): HouseScoreV04ActiveProjection {
  const bytes = readFileSync(join(root, SHADOW_PATH));
  if (bytes.length !== 540_469 || fileSha(bytes) !== SHADOW_SHA) throw new Error("HOUSE_V04_ACTIVE_PARENT_INVALID");
  const shadow = validateHouseScoreV04ShadowProjection(JSON.parse(bytes.toString("utf8")), root);
  const lock = JSON.parse(readFileSync(join(root, "data/source-lock.json"), "utf8")) as { entries: readonly { id?: unknown; retainedPath?: unknown; retainedStatus?: unknown; byteSize?: unknown; sha256?: unknown }[] };
  const parentEntries = lock.entries.filter((entry) => entry.id === "house-score-v04-shadow-projection-v1");
  if (parentEntries.length !== 1 || parentEntries[0]!.retainedPath !== SHADOW_PATH || parentEntries[0]!.retainedStatus !== "retained" || parentEntries[0]!.byteSize !== bytes.length || parentEntries[0]!.sha256 !== SHADOW_SHA) throw new Error("HOUSE_V04_ACTIVE_PARENT_LOCK_INVALID");
  const rows = shadow.rows.map((row) => {
    const unsigned = {
      seatCycleId: row.seatCycleId,
      districtLabel: row.districtLabel,
      incumbentParty: row.incumbentParty,
      qualifyingRoute: row.qualifyingRoute,
      previousScoreVersion: "v0.3" as const,
      previousScore: row.activeScore,
      activeScoreVersion: "v0.4" as const,
      activeScore: row.shadowScore,
      localContext: row.localContext,
      localContextAvailableWeight: row.localContextAvailableWeight,
      exactGeographyJoin: row.exactGeographyJoin,
      movement: row.movement,
      parentShadowRowSha256: row.rowSha256,
    };
    return { ...unsigned, rowSha256: hash("dsa-seats:house-score-v04-active-row:v1", unsigned) };
  }).sort((left, right) => byteCompare(left.seatCycleId, right.seatCycleId));
  const local = rows.filter((row) => row.localContext !== null);
  const breaches = rows.filter((row) => Math.abs(row.movement) > (row.incumbentParty === "Democratic" ? 13 : 14)).length;
  if (rows.length !== 430 || new Set(rows.map((row) => row.seatCycleId)).size !== 430 || local.length !== 3 || local.map((row) => row.districtLabel).join(",") !== "DE-AL,SD-AL,WY-AL" || rows.some((row) => row.localContext === null && (row.activeScore !== row.previousScore || row.movement !== 0)) || breaches !== 0) throw new Error("HOUSE_V04_ACTIVE_CLOSURE_INVALID");
  const activationPolicy = { status: "active" as const, basis: "product_owner_directive_to_use_retained_county_context" as const, scope: "exact_at_large_geography_only" as const, missingBehavior: "preserve_v03_score_exactly" as const, splitCountyAllocation: false as const, researchFallbackScoreInputs: false as const };
  const parent = { id: "house-score-v04-shadow-projection-v1" as const, fileSha256: SHADOW_SHA, packageSha256: shadow.packageSha256, rowSetSha256: shadow.rowSetSha256 };
  const summary = { seats: 430 as const, localContextActiveSeats: 3 as const, unchangedSeats: 427 as const, routeChanges: 0 as const, movementCapBreaches: 0 as const };
  const rowSetSha256 = hash("dsa-seats:house-score-v04-active-row-set:v1", rows);
  const unsigned = { schema: "house-score-v04-active-projection-v1" as const, version: 1 as const, generatedAt: "2026-08-09T06:15:00.000Z" as const, activationPolicy, parent, rows, summary, rowSetSha256 };
  return { ...unsigned, packageSha256: hash("dsa-seats:house-score-v04-active-package:v1", unsigned) };
}

export function validateHouseScoreV04ActiveProjection(value: unknown, root = process.cwd()): HouseScoreV04ActiveProjection {
  const expected = buildHouseScoreV04ActiveProjection(root);
  if (!exact(value, expected)) throw new Error("HOUSE_V04_ACTIVE_INVALID");
  return value as HouseScoreV04ActiveProjection;
}
