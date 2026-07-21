import type { ElectionDecisionStatus } from "./gate";
export type OverlayWeight = Readonly<{ sourceUnit: string; targetUnit: string; numerator: number; denominator: number }>;
export type OverlayVote = Readonly<{ sourceUnit: string; optionKey: string; votes: number }>;
export type OverlayDeclaration = Readonly<{ sourceUnits: readonly string[]; optionKeys: readonly string[]; expectedOutputTotal: number }>;
export const MAX_OVERLAY_SOURCES = 5_000;
export const MAX_OVERLAY_OPTIONS = 100;
export const MAX_OVERLAY_TARGETS_PER_SOURCE = 1_000;
export class ElectionOverlayError extends Error { constructor(readonly code: string) { super(`Election overlay rejected: ${code}`); this.name = "ElectionOverlayError"; } }
const fail = (code: string): never => { throw new ElectionOverlayError(code); };
const valid = (x: unknown): x is string => typeof x === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(x);
const safe = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
const ordered = (xs: readonly string[]) => xs.length > 0 && xs.every(valid) && xs.every((x, i) => i === 0 || xs[i - 1]! < x);
/** Exact rational largest-remainder allocation; declarations make closure auditable. */
export function overlayApprovedSynthetic(decision: ElectionDecisionStatus, policy: string, declaration: OverlayDeclaration, votes: readonly OverlayVote[], weights: readonly OverlayWeight[]): ReadonlyMap<string, number> {
  if (decision !== "approved") fail("DECISION_NOT_APPROVED"); if (!policy.trim() || policy.length > 256 || !ordered(declaration.sourceUnits) || declaration.sourceUnits.length > MAX_OVERLAY_SOURCES || !ordered(declaration.optionKeys) || declaration.optionKeys.length > MAX_OVERLAY_OPTIONS || !safe(declaration.expectedOutputTotal)) fail("INVALID_OVERLAY_DECLARATION");
  const sources = new Set(declaration.sourceUnits), options = new Set(declaration.optionKeys), groups = new Map<string, OverlayWeight[]>(), pairs = new Set<string>();
  if (weights.length > MAX_OVERLAY_SOURCES * MAX_OVERLAY_TARGETS_PER_SOURCE || votes.length > MAX_OVERLAY_SOURCES * MAX_OVERLAY_OPTIONS) fail("OVERLAY_INPUT_TOO_LARGE");
  for (const w of weights) { const key = `${w.sourceUnit}\0${w.targetUnit}`; if (!sources.has(w.sourceUnit) || !valid(w.targetUnit) || !safe(w.numerator) || !safe(w.denominator) || w.denominator === 0 || pairs.has(key)) fail("INVALID_OR_DUPLICATE_WEIGHT"); pairs.add(key); const g = groups.get(w.sourceUnit) ?? []; if (g.length === MAX_OVERLAY_TARGETS_PER_SOURCE) fail("OVERLAY_INPUT_TOO_LARGE"); g.push(w); groups.set(w.sourceUnit, g); }
  for (const source of declaration.sourceUnits) { const group = groups.get(source); if (!group?.length) fail("WEIGHTS_DO_NOT_CLOSE"); const product = group!.reduce((n, w) => n * BigInt(w.denominator), BigInt(1)); if (group!.reduce((n, w) => n + BigInt(w.numerator) * (product / BigInt(w.denominator)), BigInt(0)) !== product) fail("WEIGHTS_DO_NOT_CLOSE"); }
  const voteRows = new Map<string, OverlayVote>(); for (const row of votes) { const key = `${row.sourceUnit}\0${row.optionKey}`; if (!sources.has(row.sourceUnit) || !options.has(row.optionKey) || !safe(row.votes) || voteRows.has(key)) fail("INVALID_OR_DUPLICATE_VOTE"); voteRows.set(key, row); }
  if (voteRows.size !== sources.size * options.size) fail("INCOMPLETE_VOTE_CLOSURE");
  const output = new Map<string, bigint>(); let inputTotal = BigInt(0);
  for (const source of declaration.sourceUnits) for (const option of declaration.optionKeys) { const vote = voteRows.get(`${source}\0${option}`)!; const sourceVotes = BigInt(vote.votes); inputTotal += sourceVotes; const group = [...groups.get(source)!].sort((a,b) => a.targetUnit < b.targetUnit ? -1 : a.targetUnit > b.targetUnit ? 1 : 0); const parts = group.map(w => { const n = sourceVotes * BigInt(w.numerator); return { w, whole: n / BigInt(w.denominator), remainder: n % BigInt(w.denominator) }; }).sort((a,b) => { const left = a.remainder * BigInt(b.w.denominator), right = b.remainder * BigInt(a.w.denominator); return left === right ? (a.w.targetUnit < b.w.targetUnit ? -1 : a.w.targetUnit > b.w.targetUnit ? 1 : 0) : left > right ? -1 : 1; }); let remaining = sourceVotes - parts.reduce((n, p) => n + p.whole, BigInt(0)); let allocated = BigInt(0); for (const part of parts) { const award = remaining > BigInt(0) ? BigInt(1) : BigInt(0); const amount = part.whole + award; remaining -= award; allocated += amount; const key = `${part.w.targetUnit}\0${option}`; output.set(key, (output.get(key) ?? BigInt(0)) + amount); } if (remaining !== BigInt(0) || allocated !== sourceVotes) fail("CONSERVATION_FAILURE"); }
  const total = [...output.values()].reduce((n, x) => n + x, BigInt(0)); if (total !== inputTotal || total !== BigInt(declaration.expectedOutputTotal) || total > BigInt(Number.MAX_SAFE_INTEGER)) fail("CONSERVATION_FAILURE");
  return new Map([...output.entries()].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => [key, Number(value)]));
}
