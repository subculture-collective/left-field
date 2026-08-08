import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DsaTargetPriorityBriefsV1 } from "@/domain/dsa-target-priority-briefs-v1";

let cached: DsaTargetPriorityBriefsV1 | undefined;

export function priorityBriefs(): DsaTargetPriorityBriefsV1 {
  if (!cached)
    cached = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "data/metadata/dsa-target-priority-briefs-20260807-v1.json",
        ),
        "utf8",
      ),
    ) as DsaTargetPriorityBriefsV1;
  return cached;
}

export function priorityBrief(
  id: string,
): DsaTargetPriorityBriefsV1["briefs"][number] | undefined {
  return priorityBriefs().briefs.find((row) => row.seatCycleId === id);
}
