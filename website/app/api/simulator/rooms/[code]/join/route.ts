import { and, eq, gt, isNull } from "drizzle-orm";
import cardPayload from "@/public/cards.json";
import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure-schema";
import { simRooms } from "@/db/schema";
import { isSameOrigin } from "@/lib/auth";
import { joinLobby, publicRoomState, validateBattleDeck } from "@/lib/simulator/engine.mjs";
import { hashRoomToken, issueRoomToken, normalizeRoomCode, validatePlayerName } from "@/lib/simulator/server";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const code = normalizeRoomCode((await context.params).code);
  if (!code) return Response.json({ error: "房間碼格式不正確。" }, { status: 400 });
  const payload = await request.json().catch(() => ({}));
  const name = validatePlayerName(payload.name);
  const validation = validateBattleDeck(payload.deck, cardPayload.cards);
  if (!name) return Response.json({ error: "玩家名稱需要 1–24 個字。" }, { status: 400 });
  if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });

  await ensureSchema();
  const [row] = await getDb().select().from(simRooms).where(and(eq(simRooms.code, code), gt(simRooms.expiresAt, Date.now()), isNull(simRooms.guestTokenHash))).limit(1);
  if (!row) return Response.json({ error: "房間不存在、已滿員或已開始。" }, { status: 404 });
  try {
    const state = joinLobby(JSON.parse(row.stateJson), name, payload.deck);
    const token = issueRoomToken();
    const tokenHash = await hashRoomToken(token);
    const [updated] = await getDb().update(simRooms).set({
      guestTokenHash: tokenHash,
      stateJson: JSON.stringify(state),
      version: row.version + 1,
      updatedAt: Date.now(),
    }).where(and(eq(simRooms.code, code), eq(simRooms.version, row.version), isNull(simRooms.guestTokenHash))).returning();
    if (!updated) return Response.json({ error: "朋友剛剛已加入這個房間。" }, { status: 409 });
    return Response.json({ code, token, version: updated.version, state: publicRoomState(state, 1) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message.trim() : "加入房間失敗。" }, { status: 400 });
  }
}
