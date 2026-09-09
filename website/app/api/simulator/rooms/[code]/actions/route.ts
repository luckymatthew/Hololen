import cardPayload from "@/public/cards.json";
import { getDb } from "@/db";
import { simRooms } from "@/db/schema";
import { isSameOrigin } from "@/lib/auth";
import { applyAction, publicRoomState } from "@/lib/simulator/engine.mjs";
import { runAiStep } from "@/lib/simulator/ai.mjs";
import { loadAuthorizedRoom, normalizeRoomCode } from "@/lib/simulator/server";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const code = normalizeRoomCode((await context.params).code);
  if (!code) return Response.json({ error: "房間碼格式不正確。" }, { status: 400 });
  const result = await loadAuthorizedRoom(request, code);
  if ("error" in result) return result.error;
  const payload = await request.json().catch(() => ({}));
  if (!Number.isInteger(payload.expectedVersion) || payload.expectedVersion !== result.row.version) {
    return Response.json({ error: "房間狀態已更新，正在同步最新畫面。", conflict: true }, { status: 409 });
  }
  try {
    const currentState = JSON.parse(result.row.stateJson);
    let state;
    if (payload.action?.type === "aiStep") {
      if (currentState.mode !== "solo" || !Number.isInteger(currentState.aiPlayer) || result.playerIndex === currentState.aiPlayer) {
        throw new Error("目前不能執行 AI 步驟。");
      }
      state = runAiStep(currentState, cardPayload.cards, currentState.aiPlayer);
    } else {
      state = applyAction(currentState, result.playerIndex, payload.action, cardPayload.cards);
    }
    const [updated] = await getDb().update(simRooms).set({
      stateJson: JSON.stringify(state),
      version: result.row.version + 1,
      updatedAt: Date.now(),
    }).where(and(eq(simRooms.code, code), eq(simRooms.version, result.row.version))).returning();
    if (!updated) return Response.json({ error: "另一位玩家已先完成操作，正在同步。", conflict: true }, { status: 409 });
    return Response.json(
      { code, version: updated.version, viewerIndex: result.playerIndex, state: publicRoomState(state, result.playerIndex) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message.trim() : "操作失敗。" }, { status: 400 });
  }
}
