import { createHash, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, writeFile, chmod, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLaunchReviewRuntime } from "./launch-review-runtime";
import { canonical, verifySignedReview, type ResolvedPublicKey, type SubjectType } from "./launch-data-proofs";

const registry = (pem: string) => JSON.stringify({ version: 1, keys: [{ keyId: "key", reviewerId: "reviewer", reviewerRole: "data_reviewer", allowedSubjectTypes: ["finance_terminal"], publicKeyPem: pem, validFrom: "2026-01-01T00:00:00Z", validUntil: null, revokedAt: null }] });
const raw = { put: async () => { throw new Error("unused"); }, read: async () => new Uint8Array([1]) };
const runtime = async (contents: string) => { const root = await mkdtemp(join(tmpdir(), "launch-runtime-")); const file = join(root, "keys.json"); await writeFile(file, contents); await chmod(file, 0o640); return loadLaunchReviewRuntime({ NODE_ENV: "test", LAUNCH_REVIEW_KEYS_FILE: file, RAW_OBJECT_ROOT: root }, raw, "/"); };
const entry = (pem: string, role: "data_reviewer" | "release_approver" = "data_reviewer", reviewerId = "reviewer", keyId = "key", allowedSubjectTypes: SubjectType[] = role === "release_approver" ? ["publication"] : ["finance_terminal"]) => ({ keyId, reviewerId, reviewerRole: role, allowedSubjectTypes, publicKeyPem: pem, validFrom: "2026-01-01T00:00:00Z", validUntil: null, revokedAt: null });
describe("launch review runtime", () => {
  it("accepts only registry-bound Ed25519 signatures and exact store identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "launch-runtime-")); const file = join(root, "keys.json"); const pair = generateKeyPairSync("ed25519"); await writeFile(file, registry(pair.publicKey.export({ type: "spki", format: "pem" }).toString())); await chmod(file, 0o640);
    const runtime = loadLaunchReviewRuntime({ NODE_ENV: "test", LAUNCH_REVIEW_KEYS_FILE: file, RAW_OBJECT_ROOT: root }, raw, "/");
    const signature = sign(null, Buffer.from("payload"), pair.privateKey).toString("base64");
    expect(await runtime.verifier.verify("payload", signature, pair.publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(true);
    expect(await runtime.verifier.verify("payload", `${signature}\n`, pair.publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(false);
    expect(await runtime.stores.resolve("local", "/wrong")).toBeUndefined();
    expect(await runtime.resolver.resolve("key", "other")).toBeUndefined();
  });
  it("rejects symlinked and malformed registries", async () => {
    const root = await mkdtemp(join(tmpdir(), "launch-runtime-")); const target = join(root, "target"); const link = join(root, "keys"); await writeFile(target, "{}"); await symlink(target, link);
    expect(() => loadLaunchReviewRuntime({ NODE_ENV: "test", LAUNCH_REVIEW_KEYS_FILE: link, RAW_OBJECT_ROOT: root }, { put: async () => { throw new Error(); }, read: async () => new Uint8Array() }, "/")).toThrow("configuration is invalid");
  });
  it("rejects reviewer or normalized Ed25519 key role overlap", async () => {
    const root = await mkdtemp(join(tmpdir(), "launch-runtime-")); const file = join(root, "keys.json"); const pair = generateKeyPairSync("ed25519"); const pem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const data = JSON.parse(registry(pem)); data.keys.push({ ...data.keys[0], keyId: "approver-key", reviewerId: "approver", reviewerRole: "release_approver", allowedSubjectTypes: ["publication"] }); await writeFile(file, JSON.stringify(data)); await chmod(file, 0o640);
    expect(() => loadLaunchReviewRuntime({ NODE_ENV: "test", LAUNCH_REVIEW_KEYS_FILE: file, RAW_OBJECT_ROOT: root }, { put: async () => { throw new Error(); }, read: async () => new Uint8Array() }, "/")).toThrow("configuration is invalid");
  });
  it("canonicalizes SPKI PEM and exposes its DER fingerprint", async () => {
    const pair = generateKeyPairSync("ed25519"); const pem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const loaded = await runtime(registry(`\n${pem.replace(/\n/g, "\r\n")}\t\n`)); const key = await loaded.resolver.resolve("key", "reviewer");
    const expected = createHash("sha256").update(createPublicKey(pem).export({ type: "spki", format: "der" })).digest("hex");
    expect(key?.publicKey).toBe(pem); expect(key?.publicKeyFingerprint).toBe(expected);
  });
  it("requires resolved public-key fingerprints", () => {
    // @ts-expect-error Resolvers must bind every key to its canonical SPKI fingerprint.
    const missing: ResolvedPublicKey = { publicKey: "key", reviewerRole: "data_reviewer", allowedSubjectTypes: ["finance_terminal"], validFrom: new Date(), validUntil: null, revokedAt: null };
    expect(missing).toBeDefined();
  });
  it("rejects private, non-Ed25519, and non-single-block key material without leaking it", async () => {
    const privatePem = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString(); const canary = "PRIVATE-CANARY";
    const rsaPem = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "pem" }).toString(); const publicPem = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString();
    const publicDer = createPublicKey(publicPem).export({ type: "spki", format: "der" });
    const appendedDer = `-----BEGIN PUBLIC KEY-----\n${Buffer.concat([publicDer, publicDer]).toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`;
    for (const pem of [`${privatePem}${canary}`, rsaPem, `${publicPem}\n${publicPem}`, `text\n${publicPem}`, appendedDer, `\u00a0${publicPem}`]) {
      try { await runtime(registry(pem)); throw new Error("accepted invalid key"); } catch (error) { expect(String(error)).toContain("configuration is invalid"); expect(String(error)).not.toContain(canary); expect(String(error)).not.toContain("BEGIN"); }
    }
  });
  it.each(["fec_mapping", "committee_mapping", "finance_page_closure", "finance_amendment_closure", "outside_spending_election_mapping", "outside_spending_closure", "finance_terminal", "finance_closure"] as const)("authorizes V2 data subject %s only for data reviewers", async subject => {
    const pair = generateKeyPairSync("ed25519"); const pem = pair.publicKey.export({ type: "spki", format: "pem" }).toString(); const loaded = await runtime(JSON.stringify({ version: 1, keys: [entry(pem, "data_reviewer", "reviewer", "key", [subject])] }));
    const signedAt = "2026-07-22T00:00:00.000Z"; const unsigned = { reviewId: "review", subjectType: subject, subjectSha256: "a".repeat(64), reviewerId: "reviewer", signedAt, keyId: "key" }; const signature = sign(null, Buffer.from(canonical(unsigned)), pair.privateKey).toString("base64");
    await expect(verifySignedReview({ ...unsigned, signature }, loaded.resolver, loaded.verifier)).resolves.toBeUndefined();
    await expect(verifySignedReview({ ...unsigned, subjectType: "publication", signature }, loaded.resolver, loaded.verifier)).rejects.toMatchObject({ code: "LAUNCH_PROOF_SIGNATURE" });
  });
  it("rejects cross-role reviewer and key overlap regardless of declaration order", async () => {
    const pem = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString(); const data = entry(pem); const approver = entry(pem, "release_approver", "REVIEWER", "approver");
    for (const keys of [[data, approver], [approver, data]]) await expect(runtime(JSON.stringify({ version: 1, keys }))).rejects.toThrow("configuration is invalid");
  });
  it("rejects noncanonical, zero-length activation, and nonpositive revocation windows", async () => {
    const pem = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }).toString(); const base = entry(pem);
    for (const invalid of [{ ...base, validFrom: "2026-02-30T00:00:00Z" }, { ...base, validUntil: base.validFrom }, { ...base, revokedAt: base.validFrom }]) await expect(runtime(JSON.stringify({ version: 1, keys: [invalid] }))).rejects.toThrow("configuration is invalid");
  });
  it("preserves V1 signed-review payload verification", async () => {
    const pair = generateKeyPairSync("ed25519"); const pem = pair.publicKey.export({ type: "spki", format: "pem" }).toString(); const loaded = await runtime(registry(pem)); const signedAt = "2026-07-22T00:00:00.000Z";
    const unsigned = { reviewId: "v1", subjectType: "finance_terminal" as const, subjectSha256: "a".repeat(64), reviewerId: "reviewer", signedAt, keyId: "key" }; const signature = sign(null, Buffer.from(canonical(unsigned)), pair.privateKey).toString("base64");
    await expect(verifySignedReview({ ...unsigned, signature }, loaded.resolver, loaded.verifier)).resolves.toBeUndefined();
  });
  it("preserves V1's fail-closed retroactive revocation policy", async () => {
    const pair = generateKeyPairSync("ed25519"); const pem = pair.publicKey.export({ type: "spki", format: "pem" }).toString(); const revoked = { ...entry(pem), revokedAt: "2026-07-23T00:00:00Z" }; const loaded = await runtime(JSON.stringify({ version: 1, keys: [revoked] })); const signedAt = "2026-07-22T00:00:00.000Z";
    const unsigned = { reviewId: "v1-revoked", subjectType: "finance_terminal" as const, subjectSha256: "a".repeat(64), reviewerId: "reviewer", signedAt, keyId: "key" }; const signature = sign(null, Buffer.from(canonical(unsigned)), pair.privateKey).toString("base64");
    await expect(verifySignedReview({ ...unsigned, signature }, loaded.resolver, loaded.verifier)).rejects.toMatchObject({ code: "LAUNCH_PROOF_SIGNATURE" });
  });
});
