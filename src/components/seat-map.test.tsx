import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SeatMap } from "./seat-map";

const descriptor = { url: "/maps/rel_1/geo_1" };
const feature = { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] } };

describe("SeatMap", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("loads only the descriptor URL into a nonfocusable inline SVG", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => feature }); vi.stubGlobal("fetch", fetch);
    const { container } = render(<SeatMap descriptor={descriptor} label="CA-01" />);
    await waitFor(() => expect(screen.getByTitle("District boundary")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(descriptor.url, expect.any(Object)); expect(container.querySelector("svg")).toHaveAttribute("focusable", "false");
  });
  it("keeps the record usable for missing, malformed, and failed boundary responses", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...feature, properties: { forbidden: true } }) }).mockRejectedValueOnce(new Error("offline")); vi.stubGlobal("fetch", fetch);
    const { rerender } = render(<SeatMap descriptor={descriptor} label="CA-01" />); await waitFor(() => expect(screen.getByText("No published boundary artifact.")).toBeInTheDocument());
    rerender(<SeatMap descriptor={{ url: "/maps/rel_1/geo_2" }} label="CA-02" />); await waitFor(() => expect(screen.getByText("Boundary temporarily unavailable.")).toBeInTheDocument());
    rerender(<SeatMap descriptor={{ url: "/maps/rel_1/geo_3" }} label="CA-03" />); await waitFor(() => expect(screen.getByText("Boundary temporarily unavailable.")).toBeInTheDocument());
  });
  it("shows the mapless fallback without a request", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); render(<SeatMap descriptor={null} label="CA-01" />);
    expect(screen.getByText("No published boundary artifact.")).toBeInTheDocument(); expect(fetch).not.toHaveBeenCalled();
  });
  it("never shows a resolved prior district while descriptor requests race", async () => {
    let resolveFirst!: (value: unknown) => void; let resolveSecond!: (value: unknown) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; })).mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; })); vi.stubGlobal("fetch", fetch);
    const { rerender, container } = render(<SeatMap descriptor={{ url: "/maps/rel_1/geo_1" }} label="CA-01" />);
    rerender(<SeatMap descriptor={{ url: "/maps/rel_1/geo_2" }} label="CA-02" />);
    expect(screen.getByText("Loading published boundary…")).toBeInTheDocument(); expect(container.querySelector("svg")).toBeNull();
    await act(async () => { resolveFirst({ ok: true, status: 200, json: async () => feature }); });
    expect(container.querySelector("svg")).toBeNull();
    await act(async () => { resolveSecond({ ok: true, status: 200, json: async () => feature }); });
    await waitFor(() => expect(screen.getByTitle("District boundary")).toBeInTheDocument());
  });
  it("synchronously clears a loaded boundary when its descriptor becomes null", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => feature }); vi.stubGlobal("fetch", fetch);
    const { rerender, container } = render(<SeatMap descriptor={descriptor} label="CA-01" />);
    await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
    rerender(<SeatMap descriptor={null} label="CA-01" />);
    expect(container.querySelector("svg")).toBeNull(); expect(screen.getByText("No published boundary artifact.")).toBeInTheDocument();
  });
});
