export type BioguideDobResult = { readonly status: "exact"; readonly birthDate: string } | { readonly status: "unavailable" | "ambiguous"; readonly birthDate: null };
export interface BioguideDownload { readonly bioguideId: string; readonly profileText: string; }
const months: Record<string, number> = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
/** This is a pure join-only parser.  Biography prose is never retained or staged. */
export function parseBioguideDob(download: BioguideDownload): BioguideDobResult {
  if (!/^[A-Z][0-9]{6}$/.test(download.bioguideId) || typeof download.profileText !== "string") throw new Error("BIOGUIDE_DOWNLOAD_MALFORMED");
  const matches = [...download.profileText.matchAll(/\bborn\b[^.\n]{0,120}?\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/gi)];
  if (!matches.length) return { status: "unavailable", birthDate: null };
  const values = new Set<string>();
  for (const match of matches) { const m = match[1]!.replace(/^./, c => c.toUpperCase()); const day = Number(match[2]); const y = Number(match[3]); const d = new Date(Date.UTC(y, months[m]!, day)); if (y < 1700 || day < 1 || d.getUTCFullYear() !== y || d.getUTCMonth() !== months[m] || d.getUTCDate() !== day) return { status: "ambiguous", birthDate: null }; values.add(`${String(y).padStart(4,"0")}-${String(months[m]! + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`); }
  return values.size === 1 ? { status: "exact", birthDate: [...values][0]! } : { status: "ambiguous", birthDate: null };
}
