import { createJsonlOperationalSignalSink, noopOperationalSignalSink, type JsonlOperationalSignalWriter, type OperationalSignalSink } from "./signals";

export const OPERATIONAL_SIGNALS_STDOUT_JSONL = "stdout-jsonl";
export interface OperationalSignalsEnvironment { readonly OPERATIONAL_SIGNALS?: string; }

/** The sole process-runtime authority for operational telemetry. */
export function createRuntimeOperationalSignalSink(
  env: OperationalSignalsEnvironment = process.env as OperationalSignalsEnvironment,
  writer: JsonlOperationalSignalWriter = (line) => { process.stdout.write(line); },
): OperationalSignalSink {
  return env.OPERATIONAL_SIGNALS === OPERATIONAL_SIGNALS_STDOUT_JSONL
    ? createJsonlOperationalSignalSink(writer)
    : noopOperationalSignalSink;
}

let defaultSink: OperationalSignalSink | undefined;
/** Lazily initializes once so independently composed server paths share one bounded sink. */
export function getRuntimeOperationalSignalSink(): OperationalSignalSink {
  defaultSink ??= createRuntimeOperationalSignalSink();
  return defaultSink;
}
