import { isSameOrigin, revokeSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": await revokeSession(request) } });
}
