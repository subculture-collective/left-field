import { buildHousePrimaryIncumbentEvidenceV2, INCUMBENT_EVIDENCE_V2 } from "@/rapid-acquisition/house-primary-incumbent-evidence-v2";
import { buildHouseScoreV09ActiveProjection, HOUSE_SCORE_V09 } from "@/rapid-acquisition/house-score-v09-active";
import type { SourceLock } from "@/rapid-acquisition/intake/source-lock";
import { buildStateLegislativePrimaryContext, STATE_LEGISLATIVE_PRIMARY_CONTEXT } from "@/rapid-acquisition/state-legislative-primary-context";

/**
 * Derived artifacts that `rapid:intake derive <id>` can build and pin.
 * Each entry names its builder, output path, lock kind, and parents, so no
 * per-artifact generator script or hand-edited lock entry is needed.
 */
export type DerivedArtifact = Readonly<{
  id: string;
  path: string;
  url: string;
  kind: string;
  parentIds: readonly string[];
  build: (root: string, lock: SourceLock) => unknown;
  describe: (value: unknown) => string[];
}>;

const summaryLine = (value: unknown): string[] => {
  const record = value as { summary?: unknown; packageSha256?: unknown; rowSetSha256?: unknown };
  return [
    `summary ${JSON.stringify(record.summary)}`,
    ...(typeof record.rowSetSha256 === "string" ? [`row set ${record.rowSetSha256}`] : []),
    `package ${String(record.packageSha256)}`,
  ];
};

export const DERIVED_ARTIFACTS: readonly DerivedArtifact[] = [
  {
    ...STATE_LEGISLATIVE_PRIMARY_CONTEXT,
    kind: "derived_artifact",
    parentIds: [
      "rapid-indiana-state-legislative-primary-results-v1", "rapid-tennessee-state-legislative-primary-results-v1", "rapid-georgia-state-legislative-primary-results-v1",
      "rapid-north-carolina-state-legislative-primary-results-v1", "rapid-alabama-state-legislative-primary-results-v1", "rapid-delaware-state-legislative-primary-results-v1",
      "rapid-hawaii-state-legislative-primary-results-v1", "rapid-missouri-state-legislative-primary-results-v1", "rapid-kentucky-state-legislative-primary-results-v1",
      "rapid-ohio-state-legislative-democratic-primary-results-v1", "rapid-north-carolina-local-office-primary-results-v1", "rapid-new-mexico-county-office-primary-results-v1",
    ],
    build: (root, lock) => buildStateLegislativePrimaryContext(root, lock),
    describe: summaryLine,
  },
  {
    ...INCUMBENT_EVIDENCE_V2,
    kind: "derived_artifact",
    build: (root, lock) => buildHousePrimaryIncumbentEvidenceV2(root, lock),
    describe: summaryLine,
  },
  {
    ...HOUSE_SCORE_V09,
    kind: "derived_artifact",
    build: (root, lock) => buildHouseScoreV09ActiveProjection(root, lock),
    describe: summaryLine,
  },
];
