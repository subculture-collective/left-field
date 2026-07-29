import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

const MAX_CSRF_AGE_MS = 30 * 60 * 1000;
const forbiddenIpHeaders = new Set(["forwarded", "x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip"]);
const headerName = /^[a-z0-9!#$%&'*+.^_`|~-]+$/;
const base64url32 = /^[A-Za-z0-9_-]{43}$/;

export interface CorrectionSecurityConfig {
  publicOrigin: string;
  trustedIpHeader: string;
  csrfSecret: string;
  rateHmacSecret: string;
}
export interface VerifiedCorrectionGate { packageSha256: string; expiresAt: string; }

export function parseCorrectionSecurityConfig(env: Record<string, string | undefined>, verified: VerifiedCorrectionGate): CorrectionSecurityConfig {
  if (!verified || !/^[a-f0-9]{64}$/.test(verified.packageSha256) || env.CORRECTION_APPROVAL_REVISION !== verified.packageSha256 || !Number.isFinite(Date.parse(verified.expiresAt)) || Date.parse(verified.expiresAt) <= Date.now() || env.CORRECTION_KILL_SWITCH !== "allow") throw new Error("correction intake is not allowed");
  const publicOrigin = env.CORRECTION_PUBLIC_ORIGIN;
  const trustedIpHeader = env.CORRECTION_TRUSTED_IP_HEADER?.toLowerCase();
  const csrfSecret = env.CORRECTION_CSRF_SECRET;
  const rateHmacSecret = env.CORRECTION_RATE_HMAC_SECRET;
  if (!publicOrigin || !isCanonicalHttpsOrigin(publicOrigin)) throw new Error("CORRECTION_PUBLIC_ORIGIN must be a canonical HTTPS origin");
  if (!trustedIpHeader || !headerName.test(trustedIpHeader) || forbiddenIpHeaders.has(trustedIpHeader)) throw new Error("CORRECTION_TRUSTED_IP_HEADER is unsafe");
  for (const [name, secret] of [["CORRECTION_CSRF_SECRET", csrfSecret], ["CORRECTION_RATE_HMAC_SECRET", rateHmacSecret]] as const) {
    if (!secret || Buffer.byteLength(secret, "utf8") < 32) throw new Error(`${name} must contain at least 32 UTF-8 bytes`);
  }
  return { publicOrigin, trustedIpHeader, csrfSecret: csrfSecret!, rateHmacSecret: rateHmacSecret! };
}

function isCanonicalHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash && url.origin === value;
  } catch { return false; }
}

const hmac = (secret: string, value: string) => createHmac("sha256", secret).update(value).digest();
export const constantTimeEqual = (left: Buffer, right: Buffer): boolean => left.length === right.length && timingSafeEqual(left, right);

export interface CsrfMaterial { cookie: string; token: string; nonce: string; expiresAt: number; }
export function issueCorrectionCsrf(config: Pick<CorrectionSecurityConfig, "csrfSecret">, now = Date.now()): CsrfMaterial {
  const nonce = randomBytes(32).toString("base64url");
  const token = `${now}.${nonce}.${hmac(config.csrfSecret, `correction-csrf:${now}:${nonce}`).toString("base64url")}`;
  return { nonce, token, expiresAt: now + MAX_CSRF_AGE_MS, cookie: `__Host-correction_csrf=${nonce}; Max-Age=1800; Path=/; Secure; HttpOnly; SameSite=Strict` };
}

export function verifyCorrectionCsrf(config: Pick<CorrectionSecurityConfig, "csrfSecret">, nonce: string | undefined, token: string | undefined, now = Date.now()): boolean {
  if (!nonce || !token) return false;
  const [issuedText, tokenNonce, signature, extra] = token.split(".");
  if (!issuedText || !tokenNonce || !signature || extra !== undefined || !base64url32.test(nonce) || !base64url32.test(tokenNonce) || !base64url32.test(signature) || !constantTimeEqual(Buffer.from(tokenNonce), Buffer.from(nonce)) || !/^\d+$/.test(issuedText)) return false;
  const issued = Number(issuedText);
  if (!Number.isSafeInteger(issued) || issued > now || now - issued > MAX_CSRF_AGE_MS) return false;
  return constantTimeEqual(Buffer.from(signature, "base64url"), hmac(config.csrfSecret, `correction-csrf:${issued}:${nonce}`));
}

export const generateCorrectionIdempotencyToken = (): string => randomBytes(32).toString("base64url");
export const isCorrectionIdempotencyToken = (value: string | null): value is string => value !== null && base64url32.test(value);

/** Returns the one valid correction cookie value, rejecting duplicate/list/malformed cookies. */
export function parseCorrectionCsrfCookie(value: string | null): string | undefined {
  if (!value || value.includes(",")) return undefined;
  const parts = value.split(";");
  let nonce: string | undefined;
  for (const part of parts) {
    const match = /^\s*([^=\s]+)=([^=;\s]*)\s*$/.exec(part);
    if (!match) return undefined;
    if (match[1] !== "__Host-correction_csrf") continue;
    if (nonce !== undefined || !base64url32.test(match[2])) return undefined;
    nonce = match[2];
  }
  return nonce;
}

type HeaderSource = Pick<Headers, "get">;
export function validateCorrectionRequestHeaders(headers: HeaderSource, config: Pick<CorrectionSecurityConfig, "publicOrigin" | "trustedIpHeader">): string | undefined {
  if (headers.get("origin") !== config.publicOrigin) return undefined;
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") return undefined;
  const contentType = headers.get("content-type");
  if (!contentType || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) return undefined;
  return canonicalTrustedIp(headers.get(config.trustedIpHeader));
}

export function canonicalTrustedIp(value: string | null): string | undefined {
  if (!value || value.trim() !== value || value.includes(",") || isIP(value) === 0) return undefined;
  try {
    const url = isIP(value) === 6 ? new URL(`http://[${value}]/`) : new URL(`http://${value}/`);
    return url.hostname.replace(/^\[|\]$/g, "");
  } catch { return undefined; }
}

export function correctionAnonymousSubjectHash(config: Pick<CorrectionSecurityConfig, "rateHmacSecret">, canonicalIp: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return hmac(config.rateHmacSecret, `correction-rate:${day}:${canonicalIp}`).toString("hex");
}
