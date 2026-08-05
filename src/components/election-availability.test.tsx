import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ElectionAvailability } from "./election-availability";
import type { ElectionDecisionViewModel } from "@/ui/view-models";

const decision = (status: "unassessed" | "unavailable" | "approved"): ElectionDecisionViewModel => {
  const missing = status === "unassessed" ? "not_collected" as const : status === "unavailable" ? "not_defensibly_modeled" as const : null;
  return {
    jurisdictionCode: "AL",
    electionYear: status === "unassessed" ? 2020 : status === "unavailable" ? 2022 : 2024,
    status,
    inputSnapshotIds: status === "unassessed" ? [] : ["snapshot_official" as never],
    coverage: {
      releaseId: "release_1" as never,
      domain: `election_${status === "unassessed" ? 2020 : status === "unavailable" ? 2022 : 2024}` as never,
      scope: { kind: "election", jurisdictionCode: "AL", electionYear: status === "unassessed" ? 2020 : status === "unavailable" ? 2022 : 2024 },
      status: status === "unassessed" ? "not_collected" : status === "unavailable" ? "unavailable" : "complete",
      expectedCount: 1,
      observedCount: status === "approved" ? 1 : 0,
      missingByReason: missing ? [{ reason: missing, count: 1 }] : [],
      quarantinedCount: 0,
      incompatibleCount: 0,
      inputSnapshotIds: status === "unassessed" ? [] : ["snapshot_official" as never],
    },
    evidence: status === "unavailable" ? [{ id: "snapshot_official", sourceUrl: "https://elections.alabama.gov/results", sourceName: "Alabama Elections", retrievedAt: "2026-01-01T00:00:00.000Z" }] : [],
  };
};

describe("ElectionAvailability", () => {
  it("distinguishes not collected, unavailable, and available without inference", () => {
    render(<ElectionAvailability jurisdictionCode="AL" decisions={[decision("unassessed"), decision("unavailable"), decision("approved")]} />);
    expect(screen.getByText(/These are availability statements for AL/)).toHaveTextContent("not findings about this seat");
    expect(screen.getByText("Not collected for this release.")).toBeVisible();
    expect(screen.getByText(/This does not mean records do not exist/)).toBeVisible();
    expect(screen.getByText("Not defensibly modeled.")).toBeVisible();
    expect(screen.getByText(/No value, winner, margin, zero, or uncontested status is inferred/)).toBeVisible();
    expect(screen.getByText("Available in this release.")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Open the release source ledger" })).toHaveLength(3);
  });

  it("links only supplied published evidence and fails closed on mismatched scope", () => {
    const unavailable = decision("unavailable");
    const mismatched = { ...unavailable, coverage: { ...unavailable.coverage!, scope: { kind: "election" as const, jurisdictionCode: "AK", electionYear: 2022 } } };
    const { rerender } = render(<ElectionAvailability jurisdictionCode="AL" decisions={[unavailable]} />);
    expect(screen.getByRole("link", { name: /Alabama Elections snapshot snapshot_official/ })).toHaveAttribute("href", "https://elections.alabama.gov/results");
    rerender(<ElectionAvailability jurisdictionCode="AL" decisions={[mismatched]} />);
    const article = screen.getByRole("heading", { name: "2022 election data for AL" }).closest("article")!;
    expect(within(article).getByText("Availability details are not published for this release.")).toBeVisible();
    expect(within(article).queryByText(/observed/)).not.toBeInTheDocument();
    expect(within(article).queryByRole("link", { name: /Alabama Elections snapshot/ })).not.toBeInTheDocument();
  });
});
