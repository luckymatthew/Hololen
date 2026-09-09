import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { decks } from "@/db/schema";
import { getSessionUser, isSameOrigin } from "@/lib/auth";
import { validateDeckName, validateDeckState } from "@/lib/deck-data";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function publicDeck(row: typeof decks.$inferSelect) {
  return { id: row.id, name: row.name, deck: JSON.parse(row.deckJson), createdAt: row.createdAt, updatedAt: row.updatedAt };
}

async function ownedDeck(request: Request, context: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) return { error: Response.json({ error: "請先登入。" }, { status: 401 }) };
  const { id } = await context.params;
  const [row] = await getDb().select().from(decks).where(and(eq(decks.id, id), eq(decks.userId, user.id))).limit(1);
  if (!row) return { error: Response.json({ error: "找不到這副牌組。" }, { status: 404 }) };
  return { user, row };
}

export async function GET(request: Request, context: RouteContext) {
  const result = await ownedDeck(request, context);
  if ("error" in result) return result.error;
  return Response.json({ deck: publicDeck(result.row) });
}

export async function PUT(request: Request, context: RouteContext) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const result = await ownedDeck(request, context);
  if ("error" in result) return result.error;
  const payload = await request.json().catch(() => ({}));
  const name = validateDeckName(payload.name);
  const deck = validateDeckState(payload.deck);
  if (!name || !deck) return Response.json({ error: "牌組名稱或內容格式不正確。" }, { status: 400 });
  const [updated] = await getDb().update(decks).set({ name, deckJson: JSON.stringify(deck), updatedAt: Date.now() }).where(eq(decks.id, result.row.id)).returning();
  return Response.json({ deck: publicDeck(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const result = await ownedDeck(request, context);
  if ("error" in result) return result.error;
  await getDb().delete(decks).where(eq(decks.id, result.row.id));
  return Response.json({ ok: true });
}
