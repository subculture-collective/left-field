import { describe, expect, it, vi } from "vitest";
import { boundedFailureCode, createJsonlOperationalSignalSink, emitOperationalSignal, MAX_OPERATIONAL_SIGNAL_LINE_BYTES, MAX_OPERATIONAL_SIGNAL_PENDING, noopOperationalSignalSink, operationalSignalSchema } from "./signals";

const signal = { version: 1 as const, timestamp: "2026-07-21T00:00:00.000Z", kind: "ingestion" as const, releaseId: "rel_1", sourceId: "source_1", outcome: "success" as const, extractedCount: 1, stagedCount: 1, quarantinedCount: 0, durationMs: 2 };
describe("operational signals", () => {
  it("uses a no-op default and emits only the strict allowlist", () => {
    expect(() => emitOperationalSignal(noopOperationalSignalSink, signal)).not.toThrow();
    expect(operationalSignalSchema.parse(signal)).toEqual(signal);
  });
  it("uses strict outcome branches", () => {
    expect(() => operationalSignalSchema.parse({ ...signal, failureCode: "INGESTION_FAILED" })).toThrow();
    expect(() => operationalSignalSchema.parse({ ...signal, outcome: "failure" })).toThrow();
    expect(operationalSignalSchema.parse({ ...signal, outcome: "failure", failureCode: "INGESTION_FAILED" })).toMatchObject({ outcome: "failure" });
  });
  it.each(["address", "coordinates", "ipHash", "correctionText", "url", "contributor", "bindValues", "objectLocator", "token", "error", "message"])('rejects forbidden field %s', (field) => {
    expect(() => operationalSignalSchema.parse({ ...signal, [field]: field === "error" ? new Error("raw") : "secret" })).toThrow();
  });
  it("swallows sink failures without retrying", () => {
    const sink = { emit: vi.fn(() => { throw new Error("sink down"); }) };
    expect(() => emitOperationalSignal(sink, signal)).not.toThrow();
    expect(sink.emit).toHaveBeenCalledOnce();
  });
  it("suppresses async sink rejections without retrying", async () => {
    const sink = { emit: vi.fn(() => Promise.reject(new Error("sink down"))) };
    emitOperationalSignal(sink, signal);
    await Promise.resolve(); await Promise.resolve();
    expect(sink.emit).toHaveBeenCalledOnce();
  });
  it("serializes default-queue writer calls in emission order", async () => {
    const lines: string[] = []; let concurrent = 0; let maximum = 0;
    const writer = vi.fn(async (line: string) => { concurrent += 1; maximum = Math.max(maximum, concurrent); await Promise.resolve(); lines.push(JSON.parse(line).releaseId); concurrent -= 1; });
    const sink = createJsonlOperationalSignalSink(writer);
    for (const releaseId of ["rel_1", "rel_2", "rel_3"]) sink.emit({ ...signal, releaseId });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(maximum).toBe(1); expect(lines).toEqual(["rel_1", "rel_2", "rel_3"]);
  });
  it("bounds the pending queue and recovers after a rejected writer", async () => {
    const lines: string[] = []; let rejectFirst = true; let concurrent = 0; let maximum = 0;
    const writer = vi.fn((line: string) => { concurrent += 1; maximum = Math.max(maximum, concurrent); if (rejectFirst) { rejectFirst = false; concurrent -= 1; return Promise.reject(new Error("raw writer error")); } lines.push(JSON.parse(line).releaseId); concurrent -= 1; return undefined; });
    const sink = createJsonlOperationalSignalSink(writer, MAX_OPERATIONAL_SIGNAL_PENDING);
    for (let i = 0; i <= MAX_OPERATIONAL_SIGNAL_PENDING + 1; i += 1) sink.emit({ ...signal, releaseId: `rel_${i}` });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(writer).toHaveBeenCalledTimes(MAX_OPERATIONAL_SIGNAL_PENDING);
    expect(maximum).toBe(1);
    expect(lines).toEqual(Array.from({ length: MAX_OPERATIONAL_SIGNAL_PENDING - 1 }, (_, i) => `rel_${i + 1}`));
    expect(JSON.stringify(writer.mock.calls)).not.toContain("raw writer error");
  });
  it("drops invalid and oversized JSONL payloads before calling its writer", async () => {
    const writer = vi.fn(); const sink = createJsonlOperationalSignalSink(writer);
    sink.emit({ ...signal, releaseId: "x".repeat(MAX_OPERATIONAL_SIGNAL_LINE_BYTES) } as never);
    sink.emit({ ...signal, failureCode: "INGESTION_FAILED" } as never);
    await Promise.resolve();
    expect(writer).not.toHaveBeenCalled();
  });
  it("never derives failure codes from an error message", () => {
    expect(boundedFailureCode("repository")).toBe("REPOSITORY_FAILED");
    expect(() => operationalSignalSchema.parse({ ...signal, outcome: "failure", failureCode: "SECRET_TOKEN_EXFILTRATED" })).toThrow();
  });
});
