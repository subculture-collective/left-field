export type AddressMode = "disabled" | "canary" | "enabled";
export interface AddressConfig {
  mode: AddressMode; deploymentId?: string; approvalRevision?: string; databaseUrl?: string; releaseId?: string;
  publicOrigin?: string; trustedIpHeader?: string; csrfSecret?: string; subjectHmacSecret?: string; subjectGeneration?: string;
  canary?: { keyId: string; secret: string; notBefore: number; until: number; vectors: Map<string, string> };
}
export interface VerifiedAddressGate { packageSha256: string; expiresAt: string; }
const header = /^[a-z0-9!#$%&'*+.^_`|~-]+$/;
const forbidden = new Set(["forwarded", "x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip"]);
const hex64 = /^[a-f0-9]{64}$/;
const secret = (value: string | undefined, name: string) => { if (!value || Buffer.byteLength(value) < 32) throw new Error(`${name} must be at least 32 bytes`); return value; };
const canonicalOrigin = (value: string | undefined) => { try { const u = new URL(value!); return u.protocol === "https:" && !u.username && !u.password && u.pathname === "/" && !u.search && !u.hash && u.origin === value; } catch { return false; } };
function vectors(value: string | undefined): Map<string, string> {
  if (!value) throw new Error("ADDRESS_CANARY_ALLOWLIST is required");
  try {
    const parsed: unknown = JSON.parse(value); const entries = Array.isArray(parsed) ? parsed.map((x) => typeof x === "object" && x !== null ? [Reflect.get(x, "id"), Reflect.get(x, "sha256")] : []) : Object.entries(parsed as object);
    const result = new Map<string, string>(); for (const [id, digest] of entries) { if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || typeof digest !== "string" || !hex64.test(digest) || result.has(id)) throw new Error("invalid canary allowlist"); result.set(id, digest); } if (!result.size) throw new Error("empty canary allowlist"); return result;
  } catch { throw new Error("invalid canary allowlist"); }
}
/** The route supplies this only from the verified root-owned gate. */
export function parseAddressConfig(env: Record<string, string | undefined>, mode: AddressMode = "disabled", verified?: VerifiedAddressGate): AddressConfig {
  if (mode !== "disabled" && mode !== "canary" && mode !== "enabled") throw new Error("invalid address mode");
  if (mode === "disabled") return { mode };
  if (env.ADDRESS_LOOKUP_KILL_SWITCH !== "allow") throw new Error("address lookup is not allowed");
  const deploymentId = env.ADDRESS_DEPLOYMENT_ID, approvalRevision = env.ADDRESS_APPROVAL_REVISION, databaseUrl = env.ADDRESS_DATABASE_URL, releaseId = env.ADDRESS_RELEASE_ID;
  const deployments = env.ADDRESS_DEPLOYMENT_ALLOWLIST?.split(",");
  if (!verified || !hex64.test(verified.packageSha256) || !Number.isFinite(Date.parse(verified.expiresAt)) || Date.parse(verified.expiresAt) <= Date.now() || !deploymentId || !deployments?.length || deployments.some((id) => !/^[A-Za-z0-9_-]{1,128}$/.test(id)) || new Set(deployments).size !== deployments.length || !deployments.includes(deploymentId) || !approvalRevision || approvalRevision !== verified.packageSha256 || !databaseUrl || !releaseId || env.ADDRESS_PRODUCT_VINTAGE !== "2025") throw new Error("invalid address deployment configuration");
  const base = { mode, deploymentId, approvalRevision, databaseUrl, releaseId } as AddressConfig;
  if (mode === "canary") {
    const keyId = env.ADDRESS_CANARY_KEY_ID, rawNotBefore = env.ADDRESS_CANARY_NOT_BEFORE, rawUntil = env.ADDRESS_CANARY_UNTIL;
    const notBefore = Number(rawNotBefore), until = Number(rawUntil);
    const verifiedUntil = Date.parse(verified.expiresAt);
    if (!keyId || !/^[A-Za-z0-9_-]{1,128}$/.test(keyId) || !Number.isSafeInteger(notBefore) || !Number.isSafeInteger(until) || until <= notBefore || until - notBefore > 15 * 60 || String(notBefore) !== rawNotBefore || String(until) !== rawUntil || !Number.isFinite(verifiedUntil) || until * 1000 > verifiedUntil) throw new Error("invalid canary window");
    return { ...base, canary: { keyId, secret: secret(env.ADDRESS_CANARY_HMAC_SECRET, "ADDRESS_CANARY_HMAC_SECRET"), notBefore, until, vectors: vectors(env.ADDRESS_CANARY_ALLOWLIST) } };
  }
  const trustedIpHeader = env.ADDRESS_TRUSTED_IP_HEADER?.toLowerCase();
  if (!canonicalOrigin(env.ADDRESS_PUBLIC_ORIGIN) || !trustedIpHeader || !header.test(trustedIpHeader) || forbidden.has(trustedIpHeader)) throw new Error("invalid enabled address configuration");
  const subjectGeneration = env.ADDRESS_SUBJECT_HMAC_GENERATION;
  if (!subjectGeneration || !/^[A-Za-z0-9_-]{1,128}$/.test(subjectGeneration)) throw new Error("active subject generation required");
  return { ...base, publicOrigin: env.ADDRESS_PUBLIC_ORIGIN, trustedIpHeader, csrfSecret: secret(env.ADDRESS_CSRF_SECRET, "ADDRESS_CSRF_SECRET"), subjectHmacSecret: secret(env.ADDRESS_SUBJECT_HMAC_SECRET, "ADDRESS_SUBJECT_HMAC_SECRET"), subjectGeneration };
}
