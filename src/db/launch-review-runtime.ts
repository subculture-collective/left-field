import { constants, openSync, closeSync, fstatSync, lstatSync, readFileSync, statSync } from "node:fs";
import { createHash, createPublicKey, verify } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { LaunchArtifactStoreResolver, PublicKeyResolver, ResolvedPublicKey, SignatureVerifier, SubjectType } from "./launch-data-proofs";
import type { RawObjectStore } from "@/ingestion/core/raw-object-store";

const productionRegistry = "/etc/dsa-seats/launch-review-keys.json";
const maxRegistryBytes = 128 * 1024;
const subjects = new Set<SubjectType>(["fec_mapping", "committee_mapping", "finance_page_closure", "finance_amendment_closure", "vacancy", "finance_terminal", "finance_closure", "election_decision", "election_result", "election_geometry", "outside_spending_election_mapping", "outside_spending_closure", "publication"]);
type Entry = { keyId: string; reviewerId: string; reviewerRole: "data_reviewer" | "release_approver"; allowedSubjectTypes: SubjectType[]; publicKeyPem: string; publicKeyFingerprint: string; validFrom: string; validUntil: string | null; revokedAt: string | null };

const invalid = (): never => { throw new Error("Launch review runtime configuration is invalid"); };
const date = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && (value === parsed.toISOString() || value === parsed.toISOString().replace(".000Z", "Z")) ? parsed : undefined;
};
// Registry PEM is exactly one SPKI PUBLIC KEY block. Only outer ASCII whitespace and
// CRLF line endings normalize; the decoded body must be the canonical SPKI bytes.
function publicKeyMaterial(value: string): { pem: string; fingerprint: string } {
  const input = value.replace(/\r\n/g, "\n").replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, "");
  const match = /^-----BEGIN PUBLIC KEY-----\n((?:[A-Za-z0-9+/=]{1,64}\n)+)-----END PUBLIC KEY-----$/.exec(input);
  if (!match) invalid();
  try {
    const body = match![1].replace(/\n/g, "");
    const encoded = Buffer.from(body, "base64");
    if (encoded.toString("base64") !== body) invalid();
    const key = createPublicKey({ key: encoded, format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519") invalid();
    const der = key.export({ type: "spki", format: "der" });
    if (!encoded.equals(der)) invalid();
    return { pem: key.export({ type: "spki", format: "pem" }).toString(), fingerprint: createHash("sha256").update(der).digest("hex") };
  } catch { return invalid(); }
}
function entry(value: unknown): Entry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  const names = ["keyId", "reviewerId", "reviewerRole", "allowedSubjectTypes", "publicKeyPem", "validFrom", "validUntil", "revokedAt"];
  if (Object.keys(row).length !== names.length || !names.every(name => name in row) || typeof row.keyId !== "string" || !/^[A-Za-z0-9:_-]{1,128}$/.test(row.keyId) || typeof row.reviewerId !== "string" || !/^[A-Za-z0-9:_-]{1,128}$/.test(row.reviewerId) || (row.reviewerRole !== "data_reviewer" && row.reviewerRole !== "release_approver") || typeof row.publicKeyPem !== "string" || !row.publicKeyPem || row.publicKeyPem.length > 16 * 1024 || !Array.isArray(row.allowedSubjectTypes) || !row.allowedSubjectTypes.length || row.allowedSubjectTypes.some(item => typeof item !== "string" || !subjects.has(item as SubjectType)) || new Set(row.allowedSubjectTypes).size !== row.allowedSubjectTypes.length || !date(row.validFrom) || (row.validUntil !== null && !date(row.validUntil)) || (row.revokedAt !== null && !date(row.revokedAt))) return invalid();
  const material = publicKeyMaterial(row.publicKeyPem);
  const parsed = { keyId: row.keyId, reviewerId: row.reviewerId, reviewerRole: row.reviewerRole, allowedSubjectTypes: row.allowedSubjectTypes as SubjectType[], publicKeyPem: material.pem, publicKeyFingerprint: material.fingerprint, validFrom: row.validFrom, validUntil: row.validUntil, revokedAt: row.revokedAt } as Entry;
  if ((parsed.reviewerRole === "release_approver") !== (parsed.allowedSubjectTypes.length === 1 && parsed.allowedSubjectTypes[0] === "publication") || (parsed.validUntil && date(parsed.validUntil)! <= date(parsed.validFrom)!) || (parsed.revokedAt && date(parsed.revokedAt)! <= date(parsed.validFrom)!)) return invalid();
  return parsed;
}

function readRegistry(path: string, production: boolean): Entry[] {
  try {
    const parentPath = dirname(path), parentBefore = statSync(parentPath), parentNamed = lstatSync(parentPath);
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const descriptor = fstatSync(fd), named = lstatSync(path), parentAfter = statSync(parentPath), effectiveGid = process.getegid?.();
      if (!parentBefore.isDirectory() || parentNamed.isSymbolicLink() || !descriptor.isFile() || descriptor.size > maxRegistryBytes || descriptor.dev !== named.dev || descriptor.ino !== named.ino || parentBefore.dev !== parentAfter.dev || parentBefore.ino !== parentAfter.ino || (production && (effectiveGid === undefined || parentBefore.uid !== 0 || parentBefore.gid !== effectiveGid || (parentBefore.mode & 0o777) !== 0o750 || descriptor.uid !== 0 || (descriptor.mode & 0o777) !== 0o640 || descriptor.gid !== effectiveGid))) return invalid();
      const bytes = readFileSync(fd); const namedAfter = lstatSync(path), parentFinal = statSync(parentPath); if (bytes.byteLength > maxRegistryBytes || descriptor.dev !== namedAfter.dev || descriptor.ino !== namedAfter.ino || parentBefore.dev !== parentFinal.dev || parentBefore.ino !== parentFinal.ino) return invalid();
      const raw: unknown = JSON.parse(bytes.toString("utf8"));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid();
      const record = raw as Record<string, unknown>;
      if (Object.keys(record).length !== 2 || record.version !== 1 || !Array.isArray(record.keys)) return invalid();
      const entries = record.keys.map(entry);
      if (!entries.length || new Set(entries.map(item => item.keyId)).size !== entries.length) return invalid();
      return entries;
    } finally { closeSync(fd); }
  } catch { return invalid(); }
}

export interface LaunchReviewRuntime { readonly resolver: PublicKeyResolver; readonly verifier: SignatureVerifier; readonly stores: LaunchArtifactStoreResolver; }
export function loadLaunchReviewRuntime(env: NodeJS.ProcessEnv, rawStore: RawObjectStore, projectRoot = process.cwd()): LaunchReviewRuntime {
  const production = env.NODE_ENV === "production";
  const registry = readRegistry(production ? productionRegistry : env.LAUNCH_REVIEW_KEYS_FILE || "", production);
  const reviewers = new Map<string, string>(); const fingerprints = new Map<string, string>();
  for (const item of registry) { const reviewer = reviewers.get(item.reviewerId.toLowerCase()), key = fingerprints.get(item.publicKeyFingerprint); if ((reviewer && reviewer !== item.reviewerRole) || (key && key !== item.reviewerRole)) invalid(); reviewers.set(item.reviewerId.toLowerCase(), item.reviewerRole); fingerprints.set(item.publicKeyFingerprint, item.reviewerRole); }
  const keys = new Map(registry.map(item => [`${item.keyId}\0${item.reviewerId}`, item]));
  const storeKind = production ? "s3" : "local";
  const identity = production ? env.RAW_OBJECT_BUCKET : env.RAW_OBJECT_ROOT ? resolve(projectRoot, env.RAW_OBJECT_ROOT) : undefined;
  if (!identity) invalid();
  return {
    resolver: { async resolve(keyId, reviewerId): Promise<ResolvedPublicKey | undefined> { const value = keys.get(`${keyId}\0${reviewerId}`); return value ? { publicKey: value.publicKeyPem, publicKeyFingerprint: value.publicKeyFingerprint, reviewerRole: value.reviewerRole, allowedSubjectTypes: value.allowedSubjectTypes, validFrom: date(value.validFrom)!, validUntil: value.validUntil ? date(value.validUntil)! : null, revokedAt: value.revokedAt ? date(value.revokedAt)! : null } : undefined; } },
    verifier: { async verify(payload, signature, publicKey): Promise<boolean> { try { if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(signature)) return false; const bytes = Buffer.from(signature, "base64"); if (bytes.byteLength !== 64 || bytes.toString("base64") !== signature) return false; const key = createPublicKey({ key: publicKeyMaterial(publicKey).pem, format: "pem", type: "spki" }); return verify(null, Buffer.from(payload, "utf8"), key, bytes); } catch { return false; } } },
    stores: { async resolve(kind, storeIdentity) { if (kind !== storeKind || storeIdentity !== identity) return undefined; return { read: receipt => rawStore.read({ storeKind: receipt.storeKind, storeLocator: storeIdentity, objectKey: receipt.objectKey, sha256: receipt.sha256, byteSize: receipt.byteSize, ...(receipt.versionId ? { versionId: receipt.versionId } : {}), ...(receipt.etag ? { etag: receipt.etag } : {}) }) }; } },
  };
}
