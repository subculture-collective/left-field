import { loadMethodologyPage } from "@/ui/server-data";
import { Shell, RouteState, fmtDate } from "@/components/presentational";
export const dynamic = "force-dynamic";
export default async function Methodology() { const result = await loadMethodologyPage(); if (!result.ok) return <RouteState code={result.code} />; const { value: page } = result; return <Shell release={page.release}><main className="page prose"><p className="eyebrow">METHOD NOTE / {page.release.label}</p><h1>How this release is described</h1><p className="lede">Source cutoff: {fmtDate(page.release.sourceCutoff)}. Release status: {page.release.status}.</p>{page.sections.map(section => <section className="record-section" key={section.topic}><h2>{section.topic}</h2><p>{section.explanation}</p></section>)}</main></Shell>; }
