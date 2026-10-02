"use client";
import Link from "next/link";
import { Shell } from "@/components/presentational";
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <Shell><main id="content" className="page state"><p className="eyebrow">RECORD STATUS</p><h1>Record unavailable</h1><p>The requested research record could not be displayed. You can retry this request or return to the active release.</p><div className="state-actions"><button type="button" onClick={reset}>Try again</button><Link prefetch={false} className="button" href="/browse">Return to browse</Link></div></main></Shell>; }
