import { lstat, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { encodeFecAcquisitionPlan, fecAcquisitionPlanSha256 } from "@/ingestion/fec/acquisition-plan";
import { localResearchPlan, parseFetchFecLocalArguments, readLocalManifest, readLocalResearchArtifact, writeLocalManifest, writeLocalResearchArtifact } from "./fetch-fec-local";

describe("fetch-fec-local", () => {
  it("makes the fixed, deterministic local-only 541-target plan", () => {
    const plan = localResearchPlan(), bytes = encodeFecAcquisitionPlan(plan);
    expect(plan.receiptCutoff).toBe("2026-07-18");
    expect(plan.enumerationLowerBound).toBe("2025-01-01");
    expect(plan.targets).toHaveLength(541);
    expect(plan.targets[0]).toMatchObject({ seatCycleId: "local_fec_scope_001" });
    expect(plan.targets.at(-1)).toMatchObject({ seatCycleId: "local_fec_scope_541" });
    expect(fecAcquisitionPlanSha256(bytes)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts only output, bounded hours, and resume", () => {
    expect(parseFetchFecLocalArguments(["--output", "m.json", "--hours", "1", "--resume"])).toEqual({ output: "m.json", artifacts: "m.json.artifacts", hours: 1, resume: true });
    for (const input of [[], ["--output", "m", "--hours", "9"], ["--output", "m", "--output", "n"], ["--release", "x"]]) expect(() => parseFetchFecLocalArguments(input)).toThrow("FEC_LOCAL_ARGUMENT_INVALID");
  });

  it("writes canonical private checkpoints and rejects symlink manifests", async () => {
    const root = await mkdtemp(join(tmpdir(), "fec-local-")), path = join(root, "manifest.json"), planSha256 = fecAcquisitionPlanSha256(encodeFecAcquisitionPlan(localResearchPlan()));
    const manifest = { schema: "fec-local-research-manifest-v1" as const, publicationEligible: false as const, reviewStatus: "unreviewed" as const, purpose: "local-research-acquisition" as const, planSha256, createdAt: "2026-07-27T00:00:00.000Z", updatedAt: "2026-07-27T00:00:00.000Z", completed: false, counts: { pages: 0, entries: 0, sanitized: 0, outcomes: 0 }, pages: [], sanitized: [], outcomes: [] };
    await writeLocalManifest(path, manifest);
    expect((await lstat(path)).mode & 0o777).toBe(0o600);
    expect((await readFile(path, "utf8")).endsWith("\n")).toBe(true);
    expect(await readLocalManifest(path)).toEqual(manifest);
    const target = join(root, "target"); await writeFile(target, "x"); await symlink(target, path + ".link");
    await expect(readLocalManifest(path + ".link")).rejects.toThrow("FEC_LOCAL_MANIFEST_UNSAFE");
  });

  it("writes and re-hashes private content-addressed research artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "fec-local-artifacts-")), bytes = Buffer.from('{"safe":true}\n');
    const record = await writeLocalResearchArtifact(root, "enumeration_page", bytes);
    expect(record.relativePath).toMatch(/^enumeration_page\/[a-f0-9]{64}\.json$/);
    expect((await lstat(join(root, record.relativePath))).mode & 0o777).toBe(0o600);
    expect(await readLocalResearchArtifact(root, record)).toEqual(bytes);
  });

  it("contains no publication, database, or object-store path", async () => {
    const source = await readFile("scripts/fetch-fec-local.ts", "utf8");
    expect(source).not.toMatch(/@\/db|\bpg\b|ingestion\/fec\/runner|release-manifest|versioned-artifact-store|FEC_V2_STORE_MODE|AWS_ACCESS_KEY_ID|S3|MinIO/i);
    expect(source).toContain('publicationEligible: false');
  });
});
