import { constants, open } from "node:fs/promises";
import { decodeFecAcquisitionPlan, type FecAcquisitionPlanV2 } from "./acquisition-plan";

const MAX_PLAN_BYTES = 256 * 1024;
export type FecPlanExpectation = Readonly<{ planSha256: string; sourceLockSha256: string; seatCycleIds: readonly string[] }>;
export type ReadFecPlanOptions = Readonly<{ path: string; expected: FecPlanExpectation }>;

/** Read an operator supplied plan without following links or accepting a changed file. */
export async function readConfiguredFecPlan(options: ReadFecPlanOptions): Promise<FecAcquisitionPlanV2> {
  if (typeof options.path !== "string" || !options.path || options.path.includes("\0")) throw new Error("FEC_V2_PLAN_PATH_INVALID");
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(options.path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > MAX_PLAN_BYTES) throw new Error("FEC_V2_PLAN_FILE_INVALID");
    const bytes = new Uint8Array(before.size);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead !== bytes.length) throw new Error("FEC_V2_PLAN_FILE_CHANGED");
    const after = await handle.stat();
    if (!after.isFile() || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error("FEC_V2_PLAN_FILE_CHANGED");
    return decodeFecAcquisitionPlan(bytes, options.expected);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FEC_")) throw error;
    throw new Error("FEC_V2_PLAN_FILE_INVALID");
  } finally { await handle?.close(); }
}
