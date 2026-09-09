import cardPayload from "@/public/cards.json";
import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure-schema";
import { simRooms } from "@/db/schema";
import { isSameOrigin } from "@/lib/auth";
import { applyAction, createLobbyState, joinLobby, publicRoomState, validateBattleDeck } from "@/lib/simulator/engine.mjs";
import { hashRoomToken, issueRoomCode, issueRoomToken, ROOM_TTL_MS, validatePlayerName } from "@/lib/simulator/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const payload = await request.json().catch(() => ({}));
  const name = validatePlayerName(payload.name);
  const validation = validateBattleDeck(payload.deck, cardPayload.cards);
  const singlePlayer = payload.singlePlayer === true;
  const opponentDeck = payload.opponentDeck || payload.deck;
  const opponentValidation = singlePlayer ? validateBattleDeck(opponentDeck, cardPayload.cards) : { ok: true };
  if (!name) return Response.json({ error: "玩家名稱需要 1–24 個字。" }, { status: 400 });
  if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });
  if (!opponentValidation.ok) return Response.json({ error: `AI 牌組：${opponentValidation.error}` }, { status: 400 });

  await ensureSchema();
  const token = issueRoomToken();
  const now = Date.now();
  let state: ReturnType<typeof createLobbyState> & { mode?: string; aiPlayer?: number } = createLobbyState(name, payload.deck);
  if (singlePlayer) {
    state = joinLobby(state, "AIこより · EXPERT", opponentDeck);
    state.mode = "solo";
    state.aiPlayer = 1;
    state = applyAction(state, 0, { type: "ready", ready: true }, cardPayload.cards);
    state = applyAction(state, 1, { type: "ready", ready: true }, cardPayload.cards);
  }
  const hostTokenHash = await hashRoomToken(token);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = issueRoomCode();
    try {
      await getDb().insert(simRooms).values({
        code,
        hostTokenHash,
        guestTokenHash: null,
        stateJson: JSON.stringify(state),
        version: 1,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + ROOM_TTL_MS,
      });
      return Response.json({ code, token, version: 1, state: publicRoomState(state, 0) }, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (attempt === 7) throw error;
    }
  }
  return Response.json({ error: "未能建立房間，請再試一次。" }, { status: 503 });
}
