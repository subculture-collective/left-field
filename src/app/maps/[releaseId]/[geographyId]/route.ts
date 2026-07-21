import { getPool } from "@/db/client";
import { servePublicMap } from "@/maps/public-map";
import { configuredMapArtifactStore } from "@/maps/runtime-map-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ releaseId: string; geographyId: string }> }): Promise<Response> {
  const { releaseId, geographyId } = await context.params;
  try { return await servePublicMap(getPool(), configuredMapArtifactStore(), releaseId, geographyId); }
  catch { return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
