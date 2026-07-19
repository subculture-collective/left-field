import { z } from "zod";

const date = z.iso.date();
const evidenceType = z.enum(["Recorded House or Senate roll-call vote", "Bill or resolution sponsorship/cosponsorship", "Congressional Record statement", "Official member press release or official-site statement", "Signed public letter whose signatories are verifiable", "Campaign statement, with the campaign and publication date clearly identified"]);
const action = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("vote"), voteType: z.enum(["substantive", "procedural"]), exactAction: z.string().min(1) }), z.strictObject({ kind: z.literal("sponsorship"), exactAction: z.string().min(1) }), z.strictObject({ kind: z.literal("cosponsorship"), exactAction: z.string().min(1) }), z.strictObject({ kind: z.literal("quote"), shortQuote: z.string().min(1) }), z.strictObject({ kind: z.literal("signed_letter"), exactAction: z.literal("signed_letter") })]);
const content = z.strictObject({ evidenceId: z.string().min(1), subject: z.strictObject({ kind: z.enum(["public_officeholder", "candidate"]), displayName: z.string().min(1) }), evidenceType, eventDate: date, action, surroundingContext: z.string().min(1), primaryUrl: z.url(), publisher: z.string().min(1), retrievedAt: date, archiveUrl: z.url().optional(), topicTags: z.array(z.enum(["ceasefire", "humanitarian_aid", "arms_transfer", "diplomacy", "international_law"])).min(1) });
export const evidenceRevisionSchema = content.extend({ revisionId: z.string().min(1), predecessorId: z.string().min(1).nullable(), status: z.enum(["ingested", "needs_review", "verified", "published", "rejected", "corrected", "republished"]), correctionNote: z.string().min(1).optional(), synthetic: z.literal(true), publication: z.literal("fictitious_non_publication") }).strict().superRefine((revision, ctx) => {
  const allowed: Record<z.infer<typeof evidenceType>, readonly z.infer<typeof action>["kind"][]> = {
    "Recorded House or Senate roll-call vote": ["vote"], "Bill or resolution sponsorship/cosponsorship": ["sponsorship", "cosponsorship"], "Congressional Record statement": ["quote"], "Official member press release or official-site statement": ["quote"], "Signed public letter whose signatories are verifiable": ["signed_letter"], "Campaign statement, with the campaign and publication date clearly identified": ["quote"],
  };
  if (!allowed[revision.evidenceType].includes(revision.action.kind)) ctx.addIssue({ code: "custom", message: "Evidence type and action are incompatible" });
  if (new Set(revision.topicTags).size !== revision.topicTags.length) ctx.addIssue({ code: "custom", message: "Topic tags must be unique" });
  if (revision.retrievedAt < revision.eventDate) ctx.addIssue({ code: "custom", message: "Retrieved date precedes event date" });
  if (revision.status === "corrected" && !revision.correctionNote) ctx.addIssue({ code: "custom", message: "Corrected revisions require a correction note" });
});
export type EvidenceRevision = Readonly<z.infer<typeof evidenceRevisionSchema>>;
const transitions: Record<EvidenceRevision["status"], readonly EvidenceRevision["status"][]> = { ingested: ["needs_review"], needs_review: ["verified", "rejected"], verified: ["published"], published: ["corrected"], corrected: ["republished"], republished: [], rejected: [] };
const stableIdentity = (r: EvidenceRevision) => JSON.stringify({ evidenceId: r.evidenceId, subject: r.subject, evidenceType: r.evidenceType, eventDate: r.eventDate });
const contentIdentity = (r: EvidenceRevision) => JSON.stringify({ ...r, revisionId: undefined, predecessorId: undefined, status: undefined, correctionNote: undefined });

export function validateRevisionChain(input: unknown): readonly EvidenceRevision[] {
  const revisions = z.array(evidenceRevisionSchema).min(1).parse(input); const ids = new Set<string>();
  revisions.forEach((revision, index) => {
    if (ids.has(revision.revisionId)) throw new Error("Duplicate revision ID"); ids.add(revision.revisionId);
    if (index === 0) { if (revision.predecessorId !== null || revision.status !== "ingested") throw new Error("Chain must begin ingested"); return; }
    const prior = revisions[index - 1];
    if (revision.predecessorId !== prior.revisionId) throw new Error("Revision chain must be linear");
    if (!transitions[prior.status].includes(revision.status)) throw new Error("Illegal or skipped workflow transition");
    if (stableIdentity(revision) !== stableIdentity(prior)) throw new Error("Event identity is immutable");
    if (prior.status === "corrected" && (contentIdentity(revision) !== contentIdentity(prior) || revision.correctionNote !== prior.correctionNote)) throw new Error("Republished revision must preserve corrected content and note");
    if (prior.status !== "published" && contentIdentity(revision) !== contentIdentity(prior)) throw new Error("Evidence content may only change in a correction");
  });
  return revisions;
}
