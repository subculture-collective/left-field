import { describe, expect, it } from "vitest";

import { listReleaseCoverage } from "./list-sources";

describe("listReleaseCoverage", () => {
  it("uses fixed-cardinality discriminators and casts enum reasons before bytewise ordering", async () => {
    let text = "";
    await expect(listReleaseCoverage({ query: async (sql: string) => { text = sql; return { rows: [] }; } } as never, "rel_1" as never)).resolves.toEqual([]);
    expect(text).toContain("cmr.reason::text AS reason");
    expect(text).toContain("ORDER BY r.reason COLLATE \"C\"");
    expect(text).toContain("coverage_groups AS");
    expect(text).toContain("snapshot_groups AS");
    expect(text).toContain("FROM coverage_groups g JOIN snapshot_groups s ON");
    expect(text).toContain("s.variable IS NOT DISTINCT FROM g.variable");
    expect(text).toContain("SELECT cr.domain,cr.scope_kind,cr.variable,cr.survey_period,cr.election_year,cr.funding_kind,cr.status,count(*)::int AS record_count");
    expect(text).not.toContain("GROUP BY cr.domain,cr.scope_kind,cr.jurisdiction_code");
    expect(text).not.toContain("cr.scope_key ORDER BY");
  });

  it("keeps one real-shaped coverage record at one count when it has multiple snapshots", async () => {
    const coverage = { releaseId: "rel_1", domain: "identity", scope: { kind: "release" }, status: "complete", recordCount: 1, expectedCount: 1, observedCount: 1, quarantinedCount: 0, incompatibleCount: 0, missingByReason: [], inputSnapshotCount: 2 };
    await expect(listReleaseCoverage({ query: async () => ({ rows: [{ coverage }] }) } as never, "rel_1" as never)).resolves.toEqual([coverage]);
  });
});
