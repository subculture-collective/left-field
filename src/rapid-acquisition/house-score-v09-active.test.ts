import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { readSourceLock } from "./intake/source-lock";
import { buildHouseScoreV09ActiveProjection, HOUSE_SCORE_V09, readHouseScoreV09ActiveProjection, republicanRouteScore, validateHouseScoreV09ActiveProjection } from "./house-score-v09-active";

describe("house score v0.9 Republican route and alias activation", () => {
  it("scales the Republican route by available evidence instead of a flat cap", () => {
    expect(republicanRouteScore({ competitiveness: 100, cashVulnerability: null, localContext: null, stateContestation: null })).toEqual({ score: 78, availableWeight: 0.45, weightedMean: 100, coverageMultiplier: 0.78 });
    expect(republicanRouteScore({ competitiveness: 100, cashVulnerability: 100, localContext: 100, stateContestation: 100 })).toEqual({ score: 100, availableWeight: 1, weightedMean: 100, coverageMultiplier: 1 });
    expect(republicanRouteScore({ competitiveness: 80, cashVulnerability: 40, localContext: null, stateContestation: null }).score).toBe(58.2);
  });

  it("closes over 430 seats, moves only Republican seats and the alias-resolved Democratic seat", () => {
    const value = buildHouseScoreV09ActiveProjection();
    expect(value.summary).toMatchObject({ seats: 430, republicanSeats: 218, republicanSeatsWithStateContestation: 40, republicanSeatsWithLocalContext: 3, newlyResolvedPrimarySeats: 1, routeChanges: 0, republicanMaxScore: 78.6 });
    const democratsMoved = value.rows.filter((row) => row.incumbentParty === "Democratic" && row.movementFromV08 !== 0);
    expect(democratsMoved.map((row) => row.districtLabel)).toEqual(["RI-01"]);
    expect(democratsMoved[0]).toMatchObject({ previousScore: 59.6, activeScore: 55.9, activePrimaryFeasibility: 0, primaryIdentityStatus: "reviewed_alias_relationship" });
    const ohio = value.rows.find((row) => row.districtLabel === "OH-10")!;
    expect(ohio.republicanRoute).toMatchObject({ stateContestation: 51, stateContestationCycleYear: 2026, availableWeight: 0.85, coverageMultiplier: 0.94 });
    expect(value.rows.every((row) => row.incumbentParty === "Democratic" || row.republicanRoute !== null)).toBe(true);
    expect(value.methodology.republicanRouteCap).toBe("removed");
  });

  it("matches the retained projection and rejects tampering", () => {
    const retained = JSON.parse(readFileSync(HOUSE_SCORE_V09.path, "utf8")) as unknown;
    expect(validateHouseScoreV09ActiveProjection(retained).summary.seats).toBe(430);
    const tampered = structuredClone(retained) as { rows: { activeScore: number }[] };
    tampered.rows[0]!.activeScore += 1;
    expect(() => validateHouseScoreV09ActiveProjection(tampered)).toThrow("HOUSE_V09_ACTIVE_INVALID");
  });

  it("reads the retained projection through the lock without rebuilding and rejects a wrong pin", () => {
    const value = readHouseScoreV09ActiveProjection();
    expect(value.packageSha256).toBe((JSON.parse(readFileSync(HOUSE_SCORE_V09.path, "utf8")) as { packageSha256: string }).packageSha256);
    expect(value.rows).toHaveLength(430);
    const lock = readSourceLock();
    const wrongPin = { ...lock, entries: lock.entries.map((entry) => (entry.id === HOUSE_SCORE_V09.id ? { ...entry, sha256: "0".repeat(64) } : entry)) };
    expect(() => readHouseScoreV09ActiveProjection(process.cwd(), wrongPin)).toThrow("BYTES_MISMATCH");
  });
});
