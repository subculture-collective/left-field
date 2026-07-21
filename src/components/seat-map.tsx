"use client";

import { useEffect, useState } from "react";

type Descriptor = { url: string };

function parseBoundary(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const feature = value as Record<string, unknown>; const geometry = feature.geometry as Record<string, unknown> | undefined;
  const properties = feature.properties;
  if (Object.keys(feature).length !== 3 || feature.type !== "Feature" || !properties || typeof properties !== "object" || Array.isArray(properties) || Object.keys(properties).length !== 0 || !geometry || Object.keys(geometry).length !== 2 || geometry.type !== "MultiPolygon" || !Array.isArray(geometry.coordinates)) return null;
  const rings = geometry.coordinates.flat(1); const points = rings.flat(1) as unknown[];
  if (!rings.length || !points.every((point) => Array.isArray(point) && point.length === 2 && point.every((value) => typeof value === "number" && Number.isFinite(value)))) return null;
  const coordinates = points as [number, number][]; const xs = coordinates.map(([x]) => x); const ys = coordinates.map(([, y]) => y); const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  if (minX === maxX || minY === maxY) return null;
  const scale = 180 / Math.max(maxX - minX, maxY - minY);
  return rings.map((ring) => (ring as [number, number][]).map(([x, y], index) => `${index ? "L" : "M"}${(10 + (x - minX) * scale).toFixed(2)} ${(190 - (10 + (y - minY) * scale)).toFixed(2)}`).join(" ") + " Z").join(" ");
}

export function SeatMap({ descriptor, label }: { descriptor: Descriptor | null; label: string }) {
  const url = descriptor?.url ?? null;
  const [result, setResult] = useState<{ url: string | null; state: "loading" | "loaded" | "missing" | "unavailable"; path: string | null }>({ url, state: url ? "loading" : "missing", path: null });
  // Rendering is keyed by the current URL, rather than the last resolved URL:
  // a changed descriptor can therefore never display a previous boundary.
  const current = result.url === url ? result : { url, state: url ? "loading" as const : "missing" as const, path: null };
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController(); let currentRequest = true;
    fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!currentRequest) return;
      if (response.status === 404) { setResult({ url, state: "missing", path: null }); return; }
      if (!response.ok) throw new Error();
      const boundary = parseBoundary(await response.json());
      if (!boundary) throw new Error();
      if (currentRequest) setResult({ url, state: "loaded", path: boundary });
    }).catch((error: unknown) => { if (currentRequest && (error as { name?: string }).name !== "AbortError") setResult({ url, state: "unavailable", path: null }); });
    return () => { currentRequest = false; controller.abort(); };
  }, [url]);
  return <div className="seat-map" aria-live="polite">{current.state === "loaded" && current.path ? <svg viewBox="0 0 200 200" focusable="false" aria-labelledby="boundary-map-title boundary-map-desc"><title id="boundary-map-title">District boundary</title><desc id="boundary-map-desc">Published boundary for {label}.</desc><path d={current.path} /></svg> : <div className="map-fallback">{current.state === "loading" ? "Loading published boundary…" : current.state === "missing" ? "No published boundary artifact." : "Boundary temporarily unavailable."}</div>}</div>;
}
