/** Pure scoring functions for the House Priority Index — no filesystem access. */

const one = (value: number): number => Math.round(value * 10) / 10;

export function cashVulnerabilityScore(cashOnHand: number): number {
  if (!Number.isFinite(cashOnHand)) throw new Error("HOUSE_PRIORITY_CASH_INVALID");
  if (cashOnHand <= 50_000) return 100;
  if (cashOnHand >= 5_000_000) return 0;
  return one(100 * (1 - Math.log(cashOnHand / 50_000) / Math.log(100)));
}

export function marginLabel(value: number): string {
  return `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
}