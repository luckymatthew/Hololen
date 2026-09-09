import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { decks } from "@/db/schema";
import { getSessionUser, isSameOrigin } from "@/lib/auth";
import { validateDeckName, validateDeckState } from "@/lib/deck-data";

export const dynamic = "force-dynamic";

function publicDeck(row: typeof decks.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    deck: JSON.parse(row.deckJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "請先登入。" }, { status: 401 });
  const rows = await getDb().select().from(decks).where(eq(decks.userId, user.id)).orderBy(desc(decks.updatedAt)).limit(50);
  return Response.json({ decks: rows.map(publicDeck) });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "請先登入。" }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const name = validateDeckName(payload.name);
  const deck = validateDeckState(payload.deck);
  if (!name || !deck) return Response.json({ error: "牌組名稱或內容格式不正確。" }, { status: 400 });

  const [total] = await getDb().select({ value: count() }).from(decks).where(eq(decks.userId, user.id));
  if ((total?.value ?? 0) >= 50) return Response.json({ error: "每個帳號最多保存 50 副牌組。" }, { status: 400 });

  const now = Date.now();
  const row = { id: crypto.randomUUID(), userId: user.id, name, deckJson: JSON.stringify(deck), createdAt: now, updatedAt: now };
  await getDb().insert(decks).values(row);
  return Response.json({ deck: publicDeck(row) }, { status: 201 });
}
