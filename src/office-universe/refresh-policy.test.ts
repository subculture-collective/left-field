import { describe, expect, it } from "vitest";

import { buildNationwideSourceRegistry } from "./nationwide-intake";
import { nextRefreshAt, refreshIntervalMinutes } from "./refresh-policy";

describe("office-universe refresh policy", () => {
  const discovery = buildNationwideSourceRegistry().find((source) => source.stateCode === "IN" && source.family === "discovery")!;
  const elections = { ...buildNationwideSourceRegistry().find((source) => source.stateCode === "IN" && source.family === "elections")!, status: "configured" as const };

  it("uses short election-night polling only for configured election sources", () => {
    expect(refreshIntervalMinutes(elections, "election_night")).toBe(15);
    expect(refreshIntervalMinutes(discovery, "election_night")).toBe(7 * 24 * 60);
  });

  it("keeps unknown authority slots explicit instead of repeatedly polling a guessed endpoint", () => {
    const unavailable = buildNationwideSourceRegistry().find((source) => source.stateCode === "IN" && source.family === "elections")!;
    expect(refreshIntervalMinutes(unavailable, "election_night")).toBe(24 * 60);
    expect(nextRefreshAt(unavailable, "election_night", new Date("2026-11-03T00:00:00Z"), new Date("2026-11-03T01:00:00Z")).toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });
});
