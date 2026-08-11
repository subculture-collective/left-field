import { createHash } from "node:crypto";

export const byteCompare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const canonical = (value: unknown): string =>
  value === null || typeof value !== "object"
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonical).join(",")}]`
      : `{${Object.keys(value as object).sort(byteCompare).map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;

export const hash = (domain: string, value: unknown): string =>
  createHash("sha256").update(`${domain}\0${canonical(value)}`).digest("hex");

export const sha = (value: Buffer): string =>
  createHash("sha256").update(value).digest("hex");

export const exact = (left: unknown, right: unknown): boolean =>
  canonical(left) === canonical(right);