const MAX_SAFE_CENTS = "9007199254740991";

export function isFecReportType(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9]{1,8}$/.test(value);
}

export function isFecCandidateId(value: unknown, offices = "HSP"): value is string {
  return typeof value === "string" && new RegExp(`^[${offices}][A-Z0-9]{8}$`).test(value);
}

export function isFecCommitteeId(value: unknown): value is string {
  return typeof value === "string" && /^C\d{8}$/.test(value);
}

/** Return canonical signed dollars with two decimals, or undefined when invalid. */
export function normalizeFecMoney(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  let input: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) >= 1e-7)
      return undefined;
    input = value.toFixed(2);
  } else if (typeof value === "string") {
    input = value;
  } else {
    return undefined;
  }
  const match = /^(-?)(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/.exec(input);
  if (!match) return undefined;
  const whole = (match[2] ?? "0").replace(/^0+(?=\d)/, "");
  const fraction = (match[3] ?? match[4] ?? "").padEnd(2, "0");
  const cents = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  if (cents.length > MAX_SAFE_CENTS.length || (cents.length === MAX_SAFE_CENTS.length && cents > MAX_SAFE_CENTS))
    return undefined;
  const negative = match[1] === "-" && /[1-9]/.test(cents);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function fecMoneyToCents(value: string): number | undefined {
  const normalized = normalizeFecMoney(value);
  if (normalized === null || normalized === undefined) return undefined;
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const cents = Number(unsigned.replace(".", ""));
  return Number.isSafeInteger(cents) ? (negative ? -cents : cents) : undefined;
}

export function formatFecCents(cents: number): string | undefined {
  if (!Number.isSafeInteger(cents)) return undefined;
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  return `${negative ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/** OpenFEC emits second-resolution timestamps, usually without an explicit zone. */
export function openFecTimestampDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.exec(value);
  if (!match) return undefined;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === match[1] ? match[1] : undefined;
}
