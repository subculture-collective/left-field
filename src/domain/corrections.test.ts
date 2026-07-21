import { describe, expect, it } from "vitest";

import { correctionParityVectors, correctionReleaseIdSchema, correctionSubmissionSchema, correctionSourceUrlSchema } from "./corrections";

const submission = { releaseId: "rel_1", fieldPath: "identity.party", explanation: "This explanation has enough detail." };

describe("correctionSubmissionSchema", () => {
  it("strictly accepts and deterministically normalizes submissions", () => {
    const parsed = correctionSubmissionSchema.parse({ ...submission, explanation: " \r\nThis explanation has enough detail.\r\n ", sourceUrl: "https://EXAMPLE.com/a" });
    expect(parsed).toMatchObject({ explanation: "This explanation has enough detail.", sourceUrl: "https://example.com/a" });
  });
  it.each([{ extra: true }, { explanation: "This explanation\u0000 has enough detail." }, { fieldPath: "identity.secret" }])("rejects unsafe input %o", (change) => {
    expect(correctionSubmissionSchema.safeParse({ ...submission, ...change }).success).toBe(false);
  });
  it("enforces UTF-8 limits and safe URLs", () => {
    expect(correctionSubmissionSchema.safeParse({ ...submission, explanation: "😀".repeat(4001) }).success).toBe(false);
    for (const sourceUrl of ["http://example.com", "https://user:pass@example.com", "https://example.com/#fragment", "https://example.com:443/a", "https://127.0.0.1/a", "https://example.com/a@b", "https://example.com/a\tb"]) {
      expect(correctionSubmissionSchema.safeParse({ ...submission, sourceUrl }).success).toBe(false);
    }
  });
  it("matches correction identifier and canonical URL parity vectors", () => {
    for (const vector of correctionParityVectors.ids) expect(correctionReleaseIdSchema.safeParse(vector.value).success).toBe(vector.valid);
    for (const vector of correctionParityVectors.sourceUrls) {
      const parsed = correctionSourceUrlSchema.safeParse(vector.value);
      expect(parsed.success ? parsed.data : undefined).toBe(vector.canonical);
    }
  });
  it("counts Unicode code points and rejects lone CR", () => {
    expect(correctionSubmissionSchema.safeParse({ ...submission, explanation: "😀".repeat(20) }).success).toBe(true);
    expect(correctionSubmissionSchema.safeParse({ ...submission, explanation: "This explanation\rhas enough detail." }).success).toBe(false);
    expect(correctionSubmissionSchema.safeParse({ ...submission, releaseId: "rel_" }).success).toBe(false);
  });
});
