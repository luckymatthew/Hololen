import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure-schema";
import { users } from "@/db/schema";
import { hashPassword, isSameOrigin, issueSession, validateAccountInput } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const payload = await request.json().catch(() => ({}));
  const parsed = validateAccountInput(payload.username, payload.password);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  await ensureSchema();
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.usernameNormalized, parsed.usernameNormalized)).limit(1);
  if (existing) return Response.json({ error: "這個使用者名稱已被使用。" }, { status: 409 });

  const id = crypto.randomUUID();
  const credentials = await hashPassword(parsed.password);
  await db.insert(users).values({
    id,
    username: parsed.username,
    usernameNormalized: parsed.usernameNormalized,
    ...credentials,
    createdAt: Date.now(),
  });
  const cookie = await issueSession(request, id);
  return Response.json({ user: { id, username: parsed.username } }, { status: 201, headers: { "Set-Cookie": cookie } });
}
