import { normalizeRoomCode, loadAuthorizedRoom } from "@/lib/simulator/server";
import { publicRoomState } from "@/lib/simulator/engine.mjs";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: RouteContext) {
  const code = normalizeRoomCode((await context.params).code);
  if (!code) return Response.json({ error: "房間碼格式不正確。" }, { status: 400 });
  const result = await loadAuthorizedRoom(request, code);
  if ("error" in result) return result.error;
  const state = JSON.parse(result.row.stateJson);
  return Response.json(
    { code, version: result.row.version, viewerIndex: result.playerIndex, state: publicRoomState(state, result.playerIndex) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
