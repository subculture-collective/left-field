"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const AREAS = [
  ["identity.current_holder", "Current holder"], ["identity.party", "Party"], ["identity.occupancy", "Seat occupancy"],
  ["biography.bioguide_id", "Bioguide ID"], ["biography.birth_date", "Birth date"], ["biography.other", "Other biography"],
  ["elections", "Elections"], ["finance", "Finance"], ["demographics", "District context"], ["district_boundary", "District boundary"], ["sources", "Sources"], ["other", "Other"],
] as const;

type Props = { releaseId?: string; seatCycleId?: string };
type TokenState = { csrfToken: string; idempotencyToken: string } | null;
type Status = { tone: "success" | "error"; message: string } | null;

export function isPublicId(value: string | undefined, prefix: "rel" | "seat") {
  return !!value && value.length <= 200 && new RegExp(`^${prefix}_[A-Za-z0-9_-]+$`).test(value);
}

const PUBLIC_HTTPS_URL = /^https:\/\/[A-Za-z0-9.-]+(?:[/?][A-Za-z0-9._~!$&'()*+,;=:/?%\-]*)?$/;
const NON_PUBLIC_TLDS = new Set(["localhost", "local", "internal", "test", "invalid"]);

/** Mirrors the server and database canonical_correction_source_url grammar. */
export function isPublicHttpsSourceUrl(value: string) {
  if (!/^[\x21-\x7E]+$/.test(value) || !PUBLIC_HTTPS_URL.test(value) || /%(?![0-9A-F]{2})/.test(value) || /\/(?:\.|%2E){1,2}(?:\/|\?|$)/.test(value)) return false;
  try {
    const url = new URL(value);
    const labels = url.hostname.toLowerCase().split(".");
    const canonical = url.toString();
    return url.protocol === "https:" && !url.username && !url.password && !url.hash &&
      /^[a-z0-9.-]+$/.test(url.hostname) && labels.length >= 2 &&
      labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) &&
      /^[a-z]{2,63}$/i.test(labels.at(-1) ?? "") && !NON_PUBLIC_TLDS.has(labels.at(-1) ?? "") &&
      PUBLIC_HTTPS_URL.test(value) && !/%(?![0-9A-F]{2})/.test(value) &&
      Array.from(canonical).length <= 2000 && new TextEncoder().encode(canonical).length <= 8192;
  } catch { return false; }
}

function responseMessage(status: string, _ok?: boolean) {
  void _ok;
  if (status === "accepted") return { tone: "success" as const, message: "Correction received. It will be reviewed; it may be incorporated only in a later release." };
  if (status === "replay") return { tone: "success" as const, message: "This correction was already received. It will be reviewed; no acceptance is promised." };
  if (status === "rate_limited") return { tone: "error" as const, message: "Too many submissions. Please wait and try again." };
  if (status === "malformed" || status === "too_large") return { tone: "error" as const, message: "The submission could not be accepted. Review the form and try again." };
  if (status === "conflict") return { tone: "error" as const, message: "This form was already used with different details. Reload the page before submitting again." };
  if (status === "forbidden") return { tone: "error" as const, message: "Your secure correction session has expired. Reload the page and try again." };
  if (status === "unsupported_media_type") return { tone: "error" as const, message: "The submission format was not accepted. Reload the page and try again." };
  return { tone: "error" as const, message: "The correction service is unavailable right now. Please try again later." };
}

export function CorrectionForm({ releaseId, seatCycleId }: Props) {
  const [tokens, setTokens] = useState<TokenState>(null);
  const [loading, setLoading] = useState(Boolean(releaseId));
  const [submitting, setSubmitting] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [errors, setErrors] = useState<{ explanation?: string; sourceUrl?: string }>({});
  const [explanation, setExplanation] = useState("");
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!releaseId) return;
    let active = true;
    fetch("/api/corrections", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("unavailable")))
      .then((value: unknown) => {
        if (!value || typeof value !== "object" || typeof (value as Record<string, unknown>).csrfToken !== "string" || typeof (value as Record<string, unknown>).idempotencyToken !== "string") throw new Error("invalid response");
        if (active) setTokens(value as TokenState);
      })
      .catch(() => { if (active) setStatus({ tone: "error", message: "Correction service configuration is unavailable. Please try again later." }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [releaseId]);

  useEffect(() => { if (status) statusRef.current?.focus(); }, [status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || terminal || !tokens || !releaseId) return;
    const form = new FormData(event.currentTarget);
    const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
    const submittedExplanation = String(form.get("explanation")).trim();
    const nextErrors: { explanation?: string; sourceUrl?: string } = {};
    const explanationLength = Array.from(submittedExplanation).length;
    if (explanationLength < 20 || explanationLength > 4000) nextErrors.explanation = "Enter an explanation between 20 and 4,000 characters.";
    if (sourceUrl && !isPublicHttpsSourceUrl(sourceUrl)) nextErrors.sourceUrl = "Enter a public HTTPS URL without credentials, a fragment, private hostnames, ports, or invalid URL encoding.";
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); setStatus({ tone: "error", message: "Review the highlighted fields before submitting." }); return; }
    setErrors({});
    const body = { releaseId, ...(seatCycleId ? { seatCycleId } : {}), fieldPath: String(form.get("fieldPath")), explanation: submittedExplanation, ...(sourceUrl ? { sourceUrl } : {}) };
    setSubmitting(true); setStatus(null);
    try {
      const response = await fetch("/api/corrections", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": tokens.csrfToken, "Idempotency-Key": tokens.idempotencyToken }, body: JSON.stringify(body) });
      const result: unknown = await response.json().catch(() => ({}));
      const apiStatus = result && typeof result === "object" && typeof (result as Record<string, unknown>).status === "string" ? (result as Record<string, string>).status : "unavailable";
      if (apiStatus === "accepted" || apiStatus === "replay") setTerminal(true);
      setStatus(responseMessage(apiStatus, response.ok));
    } catch { setStatus({ tone: "error", message: "The correction service is unavailable right now. Please try again later." }); }
    finally { setSubmitting(false); }
  }

  if (!releaseId) return <section className="notice correction-state" aria-labelledby="correction-unavailable"><h2 id="correction-unavailable">Correction form unavailable</h2><p>Open this form from a published seat record so its immutable release identifier can be cited.</p></section>;
  return <section className="correction-layout" aria-label="Correction submission"><aside className="correction-notes"><p className="eyebrow">RELEASE NOTE</p><p>The cited release is immutable. A submission is reviewed and may be incorporated only in a later release. Sending a correction does not promise acceptance.</p><dl><dt>Cited release</dt><dd><code>{releaseId}</code></dd>{seatCycleId && <><dt>Seat cycle</dt><dd><code>{seatCycleId}</code></dd></>}</dl></aside><form className="correction-form" onSubmit={submit} noValidate>
    <input type="hidden" name="releaseId" value={releaseId} />{seatCycleId && <input type="hidden" name="seatCycleId" value={seatCycleId} />}
    <label htmlFor="correction-area">Correction area<select id="correction-area" name="fieldPath" defaultValue="identity.current_holder" required disabled={terminal}>{AREAS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label htmlFor="correction-explanation">What should be corrected?<textarea id="correction-explanation" name="explanation" value={explanation} onChange={(event) => setExplanation(event.target.value)} minLength={20} maxLength={4000} required disabled={terminal} aria-invalid={Boolean(errors.explanation)} aria-describedby={`explanation-help explanation-count${errors.explanation ? " explanation-error" : ""}`} /></label>
    <p className="field-help" id="explanation-help">Use 20–4,000 characters. State the published fact, the correction, and supporting context. Do not include personal contact details, addresses, voter information, or private links.</p>{errors.explanation && <p className="field-error" id="explanation-error" role="alert">{errors.explanation}</p>}<p className="field-count" id="explanation-count" aria-live="polite">{Array.from(explanation).length} / 4,000 characters</p>
    <label htmlFor="correction-source">Source URL <span className="optional">(optional)</span><input id="correction-source" name="sourceUrl" type="url" inputMode="url" maxLength={2000} placeholder="https://example.org/record" disabled={terminal} aria-invalid={Boolean(errors.sourceUrl)} aria-describedby={`source-help${errors.sourceUrl ? " source-error" : ""}`} /></label><p className="field-help" id="source-help">If included, use a public HTTPS source link.</p>{errors.sourceUrl && <p className="field-error" id="source-error" role="alert">{errors.sourceUrl}</p>}
    <div className="correction-actions"><button type="submit" disabled={loading || !tokens || submitting || terminal}>{loading ? "Preparing form…" : submitting ? "Submitting…" : "Submit for review"}</button><p>{terminal ? "This report is complete. To report another correction, reopen or reload this page." : loading ? "Loading secure submission controls…" : "Do not submit contact details, political or voter information, addresses, demographic information, or signed/private URLs."}</p></div>
    {status && <div ref={statusRef} className={`submission-status ${status.tone}`} role="status" aria-live="polite" tabIndex={-1}>{status.message}</div>}
  </form></section>;
}
