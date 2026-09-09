import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure-schema";
import { users } from "@/db/schema";
import { isSameOrigin, issueSession, validateAccountInput, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const payload = await request.json().catch(() => ({}));
  const parsed = validateAccountInput(payload.username, payload.password);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });

  await ensureSchema();
  const [user] = await getDb().select().from(users).where(eq(users.usernameNormalized, parsed.usernameNormalized)).limit(1);
  if (!user || !(await verifyPassword(parsed.password, user.passwordSalt, user.passwordHash))) {
    return Response.json({ error: "使用者名稱或密碼不正確。" }, { status: 401 });
  }
  const cookie = await issueSession(request, user.id);
  return Response.json({ user: { id: user.id, username: user.username } }, { headers: { "Set-Cookie": cookie } });
}
