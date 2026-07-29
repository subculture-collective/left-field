import { constants } from "node:fs";
import { open, readFile, lstat } from "node:fs/promises";
import { createPublicKey, verify } from "node:crypto";
import { dirname } from "node:path";

export type CorrectionGate = { mode: "disabled" } | { mode: "enabled"; packageSha256: string; expiresAt: string };
export type AddressGate = { mode: "disabled" } | { mode: "canary" | "enabled"; packageSha256: string; expiresAt: string };
export interface FeatureGates { version: 2; generatedAt: string; signerKeyId: string; correction: CorrectionGate; address: AddressGate; signature: string; }
type Stat = { isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean; uid: number; gid: number; mode: number; ino: number; dev: number };
type GateFile = { stat(): Promise<Stat>; readFile(): Promise<Buffer>; close(): Promise<void> };
export interface GateAuthority { open(path: string, flags: number): Promise<GateFile>; lstat(path: string): Promise<Stat>; now(): number; groupId(): Promise<number>; }

const SHA = /^[a-f0-9]{64}$/, MAX_AGE_MS = 60_000, GATE_MAX_BYTES = 64 * 1024, KEY_MAX_BYTES = 32 * 1024;
const productionPath = "/run/dsa-seats/feature-gates.json", productionKeyPath = "/etc/dsa-seats/feature-gate-public-key.json";
const defaultAuthority: GateAuthority = { open: (path, flags) => open(path, flags), lstat, now: () => Date.now(), async groupId() { const line = (await readFile("/etc/group", "utf8")).split("\n").find(entry => entry.split(":", 2)[0] === "dsa-seats-gates"); if (!line) throw new Error("missing group"); const gid = Number(line.split(":")[2]); if (!Number.isSafeInteger(gid) || gid < 0) throw new Error("invalid group"); return gid; } };
function exact(value: Record<string, unknown>, keys: readonly string[]) { const actual = Object.keys(value).sort(), wanted = [...keys].sort(); return actual.length === wanted.length && actual.every((key, i) => key === wanted[i]); }
function object(value: unknown): Record<string, unknown> | undefined { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function safe(stat: Stat, gid: number, directory: boolean) { return (directory ? stat.isDirectory() : stat.isFile()) && !stat.isSymbolicLink() && stat.uid === 0 && stat.gid === gid && (stat.mode & 0o7777) === (directory ? 0o750 : 0o640); }
function same(left: Stat, right: Stat) { return left.ino === right.ino && left.dev === right.dev; }
const disabled = (): FeatureGates => ({ version: 2, generatedAt: "1970-01-01T00:00:00.000Z", signerKeyId: "", correction: { mode: "disabled" }, address: { mode: "disabled" }, signature: "" });
function validDecision(value: unknown, correction: boolean, generated: number, now: number): value is CorrectionGate | AddressGate {
  const v = object(value); if (!v || typeof v.mode !== "string") return false;
  if (v.mode === "disabled") return exact(v, ["mode"]);
  if ((correction ? v.mode !== "enabled" : v.mode !== "enabled" && v.mode !== "canary") || !exact(v, ["mode", "packageSha256", "expiresAt"]) || typeof v.packageSha256 !== "string" || !SHA.test(v.packageSha256) || typeof v.expiresAt !== "string") return false;
  const expiry = Date.parse(v.expiresAt), max = v.mode === "canary" ? 15 * 60_000 : 24 * 60 * 60_000;
  return Number.isFinite(expiry) && expiry > now && expiry > generated && expiry - generated <= max;
}
/** Stable UTF-8 serialization required by the offline signer. */
export function canonicalFeatureGate(value: Omit<FeatureGates, "signature">): Buffer {
  const correction = value.correction.mode === "disabled" ? { mode: "disabled" as const } : { mode: "enabled" as const, packageSha256: value.correction.packageSha256, expiresAt: value.correction.expiresAt };
  const address = value.address.mode === "disabled" ? { mode: "disabled" as const } : { mode: value.address.mode, packageSha256: value.address.packageSha256, expiresAt: value.address.expiresAt };
  return Buffer.from(JSON.stringify({ version: value.version, generatedAt: value.generatedAt, signerKeyId: value.signerKeyId, correction, address }), "utf8");
}
function parseGate(value: unknown, keyId: string, publicKeyPem: string, now: number): FeatureGates | undefined {
  const root = object(value); if (!root || !exact(root, ["version", "generatedAt", "signerKeyId", "correction", "address", "signature"]) || root.version !== 2 || typeof root.generatedAt !== "string" || typeof root.signerKeyId !== "string" || !/^[A-Za-z0-9:_-]{1,128}$/.test(root.signerKeyId) || typeof root.signature !== "string" || root.signerKeyId !== keyId) return undefined;
  const generated = Date.parse(root.generatedAt); if (!Number.isFinite(generated) || generated > now || now - generated > MAX_AGE_MS || !validDecision(root.correction, true, generated, now) || !validDecision(root.address, false, generated, now)) return undefined;
  const correction = root.correction as CorrectionGate, address = root.address as AddressGate;
  if (correction.mode !== "disabled" && address.mode !== "disabled" && correction.packageSha256 === address.packageSha256) return undefined;
  let signature: Buffer, key: ReturnType<typeof createPublicKey>; try { signature = Buffer.from(root.signature, "base64"); key = createPublicKey(publicKeyPem); } catch { return undefined; }
  if (signature.length !== 64 || signature.toString("base64") !== root.signature || key.asymmetricKeyType !== "ed25519" || !verify(null, canonicalFeatureGate(root as Omit<FeatureGates, "signature">), key, signature)) return undefined;
  return root as unknown as FeatureGates;
}
function parseKey(value: unknown): { keyId: string; publicKeyPem: string } | undefined { const key = object(value); return key && exact(key, ["version", "keyId", "publicKeyPem"]) && key.version === 1 && typeof key.keyId === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(key.keyId) && typeof key.publicKeyPem === "string" && key.publicKeyPem.length <= 16 * 1024 ? { keyId: key.keyId, publicKeyPem: key.publicKeyPem } : undefined; }
export function gatePath(env: Record<string, string | undefined> = process.env) { return env.NODE_ENV === "production" ? productionPath : env.DSA_SEATS_FEATURE_GATES_PATH ?? productionPath; }
export function keyPath(env: Record<string, string | undefined> = process.env) { return env.NODE_ENV === "production" ? productionKeyPath : env.DSA_SEATS_FEATURE_GATE_KEY_PATH ?? productionKeyPath; }
export function createFeatureGateReader(authority: GateAuthority = defaultAuthority, env: Record<string, string | undefined> = process.env): () => Promise<FeatureGates> {
  const paths = [gatePath(env), keyPath(env)]; let cached: FeatureGates | undefined, cachedKey: { keyId: string; publicKeyPem: string } | undefined, checkedAt = -Infinity, flight: Promise<FeatureGates> | undefined;
  const readSecure = async (path: string, max: number, gid: number): Promise<Buffer | undefined> => { const parent = dirname(path); const beforeParent = await authority.lstat(parent), beforeFile = await authority.lstat(path); if (!safe(beforeParent, gid, true) || !safe(beforeFile, gid, false)) return undefined; const file = await authority.open(path, constants.O_RDONLY | constants.O_NOFOLLOW); try { const opened = await file.stat(); if (!safe(opened, gid, false) || !same(beforeFile, opened)) return undefined; const bytes = await file.readFile(); const afterParent = await authority.lstat(parent), afterFile = await authority.lstat(path); return bytes.byteLength <= max && safe(afterParent, gid, true) && safe(afterFile, gid, false) && same(beforeParent, afterParent) && same(beforeFile, afterFile) ? bytes : undefined; } finally { await file.close(); } };
  const refresh = async (): Promise<FeatureGates> => { try { const gid = await authority.groupId(); const [gateBytes, keyBytes] = await Promise.all([readSecure(paths[0], GATE_MAX_BYTES, gid), readSecure(paths[1], KEY_MAX_BYTES, gid)]); if (!gateBytes || !keyBytes) return disabled(); const key = parseKey(JSON.parse(keyBytes.toString("utf8"))); const result = key ? parseGate(JSON.parse(gateBytes.toString("utf8")), key.keyId, key.publicKeyPem, authority.now()) : undefined; cachedKey = result ? key : undefined; return result ?? disabled(); } catch { return disabled(); } };
  return async () => { const now = authority.now(); if (cached && cachedKey && now - checkedAt >= 0 && now - checkedAt < 1_000) return parseGate(cached, cachedKey.keyId, cachedKey.publicKeyPem, now) ?? disabled(); if (!flight) flight = refresh().then(result => { cached = result; checkedAt = authority.now(); return result; }).finally(() => { flight = undefined; }); return flight; };
}
export const readFeatureGates = createFeatureGateReader();
