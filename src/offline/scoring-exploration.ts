import { z } from "zod";

export const PRIMARY_COMPONENTS = [["Recent primary competition", 25], ["Incumbent financial advantage", 25], ["Incumbency durability", 20], ["Electoral baseline stability", 15], ["Filing runway", 15]] as const;
export const GENERAL_COMPONENTS = [["Recent federal margin", 35], ["Incumbent financial advantage", 25], ["Recent contest performance", 25], ["Filing runway", 15]] as const;

const date = z.iso.date();
const normalized = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("value"), value: z.number().min(0).max(100) }), z.strictObject({ kind: z.literal("missing"), reason: z.enum(["not_collected", "not_reported", "not_applicable", "unmatched", "suppressed", "source_unavailable"]) })]);
const component = z.strictObject({ name: z.string(), weight: z.number(), rawDisplayValue: z.string().min(1), sourceObservedAt: date, normalized });
const metadata = z.strictObject({ status: z.literal("exploratory_non_production"), formulaVersion: z.literal("candidate-v1"), sourceCutoff: date, inputSnapshotId: z.string().min(1), eligibility: z.literal("House voting regular occupied only"), disclaimer: z.literal("Illustrative only; not ranking, endorsement, or prediction.") });

export const scoringFixtureSchema = z.strictObject({
  metadata,
  election: z.strictObject({ chamber: z.literal("House"), voting: z.boolean(), seatStatus: z.enum(["occupied", "vacant", "open"]), electionType: z.enum(["regular", "special"]) }),
  exploration: z.enum(["primary", "general"]), components: z.array(component).min(1),
}).superRefine((fixture, ctx) => {
  const expected = fixture.exploration === "primary" ? PRIMARY_COMPONENTS : GENERAL_COMPONENTS;
  if (fixture.components.length !== expected.length) ctx.addIssue({ code: "custom", message: "Exact component set required" });
  expected.forEach(([name, weight], index) => { const current = fixture.components[index]; if (!current || current.name !== name || current.weight !== weight) ctx.addIssue({ code: "custom", message: "PRD component names and weights must match exactly" }); });
  if (new Set(fixture.components.map((item) => item.name)).size !== fixture.components.length) ctx.addIssue({ code: "custom", message: "Components must be unique" });
  fixture.components.forEach((item) => { if (item.sourceObservedAt > fixture.metadata.sourceCutoff) ctx.addIssue({ code: "custom", message: "Observed date is after cutoff" }); });
});

export type ScoringFixture = Readonly<z.infer<typeof scoringFixtureSchema>>;
/** Validation-only helper; its result is deliberately not an evaluation input. */
export const parseScoringFixture = (input: unknown): ScoringFixture => scoringFixtureSchema.parse(input);
const freeze = <T>(value: T): Readonly<T> => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value as Readonly<T>; };
const base = { metadata: { status: "exploratory_non_production", formulaVersion: "candidate-v1", sourceCutoff: "2026-01-31", inputSnapshotId: "synthetic-scoring-snapshot-v1", eligibility: "House voting regular occupied only", disclaimer: "Illustrative only; not ranking, endorsement, or prediction." }, election: { chamber: "House", voting: true, seatStatus: "occupied", electionType: "regular" } } as const;
const primary = [{ name: "Recent primary competition", weight: 25, rawDisplayValue: "Synthetic margin: 12%", sourceObservedAt: "2026-01-01", normalized: { kind: "value", value: 80 } }, { name: "Incumbent financial advantage", weight: 25, rawDisplayValue: "Synthetic ratio: 1.2", sourceObservedAt: "2026-01-02", normalized: { kind: "value", value: 60 } }, { name: "Incumbency durability", weight: 20, rawDisplayValue: "Synthetic history: 2 cycles", sourceObservedAt: "2026-01-03", normalized: { kind: "value", value: 50 } }, { name: "Electoral baseline stability", weight: 15, rawDisplayValue: "Synthetic stability: 4 points", sourceObservedAt: "2026-01-04", normalized: { kind: "value", value: 40 } }, { name: "Filing runway", weight: 15, rawDisplayValue: "Synthetic days: 90", sourceObservedAt: "2026-01-05", normalized: { kind: "value", value: 100 } }];
const general = [{ name: "Recent federal margin", weight: 35, rawDisplayValue: "Synthetic margin: 18%", sourceObservedAt: "2026-01-01", normalized: { kind: "value", value: 70 } }, { name: "Incumbent financial advantage", weight: 25, rawDisplayValue: "Synthetic ratio: 1.1", sourceObservedAt: "2026-01-02", normalized: { kind: "value", value: 60 } }, { name: "Recent contest performance", weight: 25, rawDisplayValue: "Synthetic result: 55%", sourceObservedAt: "2026-01-03", normalized: { kind: "value", value: 55 } }, { name: "Filing runway", weight: 15, rawDisplayValue: "Synthetic days: 90", sourceObservedAt: "2026-01-04", normalized: { kind: "value", value: 100 } }];
const missing = (components: readonly object[]) => components.map((item, index) => index === 0 ? { ...item, normalized: { kind: "missing", reason: "source_unavailable" } } : item);
const make = (exploration: "primary" | "general", components: unknown, election: unknown = base.election): Readonly<ScoringFixture> => freeze(parseScoringFixture({ ...base, election, exploration, components }));
export const scoringFixtureCatalog = freeze({
  complete_primary: make("primary", primary), missing_primary: make("primary", missing(primary)), complete_general: make("general", general), missing_general: make("general", missing(general)),
  ineligible_open: make("primary", primary, { ...base.election, seatStatus: "open" }), ineligible_vacant: make("primary", primary, { ...base.election, seatStatus: "vacant" }), ineligible_delegate: make("primary", primary, { ...base.election, voting: false }), ineligible_special: make("primary", primary, { ...base.election, electionType: "special" }),
});
export type ScoringFixtureId = keyof typeof scoringFixtureCatalog;
export type Evaluation = Readonly<{ exploration: "primary" | "general"; status: "illustrative_composite"; composite: number }> | Readonly<{ exploration: "primary" | "general"; status: "unranked"; reason: "missing_components" | "ineligible"; missingComponents?: readonly string[] }>;

/** Evaluates only immutable, synthetic fixtures selected from the finite catalog. */
export function evaluateFixture(fixtureId: ScoringFixtureId): Evaluation {
  const fixture = scoringFixtureCatalog[fixtureId];
  const { exploration } = fixture;
  if (!fixture.election.voting || fixture.election.seatStatus !== "occupied" || fixture.election.electionType !== "regular") return { exploration, status: "unranked", reason: "ineligible" };
  const missing = fixture.components.filter((item) => item.normalized.kind === "missing").map((item) => item.name);
  if (missing.length) return { exploration, status: "unranked", reason: "missing_components", missingComponents: missing };
  return { exploration, status: "illustrative_composite", composite: fixture.components.reduce((total, item) => total + (item.normalized.kind === "value" ? item.normalized.value * item.weight / 100 : 0), 0) };
}
