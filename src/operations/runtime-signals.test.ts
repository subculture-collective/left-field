import { describe, expect, it, vi } from "vitest";
import { createRuntimeOperationalSignalSink } from "./runtime-signals";

const signal = { version: 1 as const, timestamp: "2026-07-21T00:00:00.000Z", kind: "repository" as const, operation: "get_active_release" as const, outcome: "success" as const, durationMs: 1 };

describe("runtime operational signals", () => {
  it("is disabled unless the exact stdout-jsonl opt-in is supplied", async () => {
    const writer = vi.fn();
    createRuntimeOperationalSignalSink({}, writer).emit(signal);
    createRuntimeOperationalSignalSink({ OPERATIONAL_SIGNALS: "stdout" }, writer).emit(signal);
    await Promise.resolve();
    expect(writer).not.toHaveBeenCalled();
  });
  it("writes only validated JSONL and swallows writer errors", async () => {
    const writer = vi.fn<(line: string) => void>(() => { throw new Error("writer secret"); });
    const sink = createRuntimeOperationalSignalSink({ OPERATIONAL_SIGNALS: "stdout-jsonl" }, writer);
    expect(() => sink.emit(signal)).not.toThrow();
    sink.emit({ ...signal, error: "secret" } as never);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(writer).toHaveBeenCalledOnce();
    expect(JSON.parse(writer.mock.calls[0]?.[0] as string)).toEqual(signal);
  });
});
