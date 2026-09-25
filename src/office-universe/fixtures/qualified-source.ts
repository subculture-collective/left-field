import type { RetainedObjectReceipt, SourceDefinition } from "../nationwide-intake";

/**
 * Synthetic reviewed fixture for contract tests. The host, identifiers, hash,
 * and bytes are invented; nothing here describes a real authority, endpoint,
 * or retained object, and it must never be seeded or run against a database.
 */
export function qualifiedSource(): SourceDefinition {
  return {
    id: "src_synthetic_in_state_legislative",
    stateCode: "IN",
    family: "elections",
    sourceKey: "state-election-authority:IN",
    authorityTier: "official",
    authorityScope: ["state_legislative"],
    precedence: 1,
    sourceUrl: "https://elections.synthetic.example/state-legislative/results",
    retentionBasis: "synthetic fixture; public official election results",
    allowedKinds: ["contest", "result"],
    privacyPolicy: "public_office_only",
    status: "reviewed",
  };
}

export function verifiedReceipt(): RetainedObjectReceipt {
  return {
    sourceId: "src_synthetic_in_state_legislative",
    locator: "office-universe/in/2024/state-legislative/results.json",
    byteSize: 1024,
    sha256: "b".repeat(64),
    retrievedAt: "2026-08-21T00:00:00Z",
    finalUrl: "https://elections.synthetic.example/state-legislative/results?cycle=2024",
    parserVersion: "synthetic-results-v1",
    verified: true,
  };
}
