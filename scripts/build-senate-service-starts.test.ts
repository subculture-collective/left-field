import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { buildArtifact, parseChronology } from "./build-senate-service-starts";
import { parseSenateServiceStartsArtifact } from "../src/ingestion/identity/senate";

const rosterPath = "data/source/identity/senate-members.xml";
const chronologyPath = "data/source/identity/senate-chronological-list.txt";
const artifactPath = "data/source/identity/senate-service-starts.json";
type ArtifactEntry = { state: string; senateClass: 1 | 2 | 3; displayName: string; initialServiceDate: string; evidence: { line: number; text: string; [key: string]: unknown; }; [key: string]: unknown; };
type Artifact = { schemaVersion: number; chronologySource: string; chronologyDated: string; entries: Record<string, ArtifactEntry>; [key: string]: unknown; };
const parseArtifact = (text: string): Artifact => JSON.parse(text) as Artifact;

describe("Senate service-start builder", () => {
  it("rebuilds the 100-entry retained artifact deterministically", async () => {
    const [roster, chronology, retained] = await Promise.all([readFile(rosterPath, "utf8"), readFile(chronologyPath, "utf8"), readFile(artifactPath, "utf8")]);
    const built = `${JSON.stringify(buildArtifact(roster, chronology), null, 2)}\n`;
    expect(built).toBe(retained);
    expect(Object.keys(JSON.parse(retained).entries)).toHaveLength(100);
    expect(Object.keys(parseSenateServiceStartsArtifact(retained))).toHaveLength(100);
  });

  it("uses bytewise ordering independently of the process locale", async () => {
    const [roster, chronology] = await Promise.all([readFile(rosterPath, "utf8"), readFile(chronologyPath, "utf8")]);
    const localeCompare = vi.spyOn(String.prototype, "localeCompare").mockImplementation(() => { throw new Error("locale ordering must not be used"); });
    expect(() => buildArtifact(roster, chronology)).not.toThrow();
    localeCompare.mockRestore();
  });

  it("uses forward-filled chronology service dates rather than end-service dates", async () => {
    const artifact = parseArtifact(await readFile(artifactPath, "utf8"));
    expect(artifact.entries.K000377.initialServiceDate).toBe("2020-12-02");
    expect(artifact.entries.M001244.initialServiceDate).toBe("2025-01-21");
    expect(artifact.entries.H001104.initialServiceDate).toBe("2025-01-18");
    expect(artifact.entries.A000383.initialServiceDate).toBe("2026-03-24");
    expect(artifact.entries.G000608.initialServiceDate).toBe("2026-07-13");
    expect(parseChronology(await readFile(chronologyPath, "utf8")).find(row => row.name === "kelly mark e")?.date).toBe("2020-12-02");
  });

  it("rejects stale or malformed strict artifacts", async () => {
    const artifact = parseArtifact(await readFile(artifactPath, "utf8"));
    artifact.entries.K000377.initialServiceDate = "2020-99-99";
    expect(() => parseSenateServiceStartsArtifact(JSON.stringify(artifact))).toThrow("Invalid Senate service-start entry");
    delete artifact.entries.K000377;
    expect(() => parseSenateServiceStartsArtifact(JSON.stringify(artifact))).toThrow("exactly 100");
  });

  it("rejects unknown fields, invalid provenance, and malformed retained entry metadata", async () => {
    const retained = await readFile(artifactPath, "utf8");
    const invalid = (mutate: (artifact: Artifact) => void) => {
      const artifact = parseArtifact(retained);
      mutate(artifact);
      expect(() => parseSenateServiceStartsArtifact(JSON.stringify(artifact))).toThrow();
    };
    invalid(artifact => { artifact.extra = true; });
    invalid(artifact => { Reflect.deleteProperty(artifact, "chronologyDated"); });
    invalid(artifact => { artifact.chronologySource = "other.txt"; });
    invalid(artifact => { artifact.chronologyDated = "2026-02-30"; });
    invalid(artifact => { artifact.entries.K000377.extra = true; });
    invalid(artifact => { Reflect.deleteProperty(artifact.entries.K000377!, "displayName"); });
    invalid(artifact => { artifact.entries.K000377.displayName = " "; });
    invalid(artifact => { artifact.entries.K000377.evidence.extra = true; });
    invalid(artifact => { artifact.entries.K000377.evidence.line = 0; });
    invalid(artifact => { artifact.entries.K000377.evidence.text = " "; });
    invalid(artifact => { artifact.entries.K000377.state = "XX"; });
    invalid(artifact => { Reflect.set(artifact.entries.K000377!, "senateClass", 4); });
  });

  it("optionally closes each Bioguide ID to its roster state and class", async () => {
    const retained = await readFile(artifactPath, "utf8");
    const artifact = parseArtifact(retained);
    const roster = Object.fromEntries(Object.entries(artifact.entries).map(([id, entry]) => [id, { state: entry.state, senateClass: entry.senateClass }]));
    expect(() => parseSenateServiceStartsArtifact(retained, roster)).not.toThrow();
    roster.K000377 = { ...roster.K000377!, senateClass: roster.K000377!.senateClass === 3 ? 2 : 3 };
    expect(() => parseSenateServiceStartsArtifact(retained, roster)).toThrow("roster conflict");
    roster.K000377 = { state: artifact.entries.K000377!.state, senateClass: artifact.entries.K000377!.senateClass };
    roster.Z999999 = { state: "CA", senateClass: 1 };
    expect(() => parseSenateServiceStartsArtifact(retained, roster)).toThrow("absent from the artifact");
  });

  it("fails closed for an unmatched roster alias or ambiguous chronology row", async () => {
    const [roster, chronology] = await Promise.all([readFile(rosterPath, "utf8"), readFile(chronologyPath, "utf8")]);
    expect(() => buildArtifact(roster.replace("<first_name>Alan</first_name>", "<first_name>Unknown</first_name>"), chronology)).toThrow("Expected exactly one chronology row");
    expect(() => buildArtifact(roster, `${chronology}\nMarch 24       Armstrong, Alan (R-OK)\n`)).toThrow("Expected exactly one chronology row");
  });
});
