import { describe, expect, it } from "vitest";
import { parseFinalizeElectionArguments } from "./finalize-elections";

const entry = JSON.stringify({ id: "clerk-2024", url: "https://example.test/clerk.pdf", sha256: "a".repeat(64), byteSize: 12 });
describe("finalize elections CLI", () => {
  it("parses bounded repeated runs and exact lock entries", () => {
    expect(parseFinalizeElectionArguments(["--release", "rel_r3", "--source-release", "rel_r2", "--run", "run_1", "--run", "run_2", "--lock-entry", entry])).toEqual({ release: "rel_r3", sourceRelease: "rel_r2", runIds: ["run_1", "run_2"], lockEntries: [{ id: "clerk-2024", url: "https://example.test/clerk.pdf", sha256: "a".repeat(64), byteSize: 12 }] });
  });
  it("rejects duplicate runs, malformed entries, and identical releases", () => {
    expect(() => parseFinalizeElectionArguments(["--release", "rel_r3", "--source-release", "rel_r3", "--run", "run_1", "--lock-entry", entry])).toThrow();
    expect(() => parseFinalizeElectionArguments(["--release", "rel_r3", "--source-release", "rel_r2", "--run", "run_1", "--run", "run_1", "--lock-entry", entry])).toThrow();
    expect(() => parseFinalizeElectionArguments(["--release", "rel_r3", "--source-release", "rel_r2", "--run", "run_1", "--lock-entry", "{}"])).toThrow();
  });
});
