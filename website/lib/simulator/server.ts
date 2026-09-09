import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure-schema";
import { simRooms } from "@/db/schema";

export const ROOM_TTL_MS = 1000 * 60 * 60 * 36;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashRoomToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function issueRoomToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function issueRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
}

export function normalizeRoomCode(value: unknown) {
  const code = typeof value === "string" ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? code : null;
}

export function validatePlayerName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name.length >= 1 && name.length <= 24 ? name : null;
}

export function roomToken(request: Request) {
  const token = request.headers.get("x-room-token") || "";
  return token.length >= 20 && token.length <= 100 ? token : null;
}

export async function loadAuthorizedRoom(request: Request, code: string) {
  await ensureSchema();
  const token = roomToken(request);
  if (!token) return { error: Response.json({ error: "缺少房間憑證，請重新用房間碼加入。" }, { status: 401 }) } as const;
  const [row] = await getDb().select().from(simRooms).where(and(eq(simRooms.code, code), gt(simRooms.expiresAt, Date.now()))).limit(1);
  if (!row) return { error: Response.json({ error: "找不到房間，或房間已過期。" }, { status: 404 }) } as const;
  const hashed = await hashRoomToken(token);
  const playerIndex = hashed === row.hostTokenHash ? 0 : hashed === row.guestTokenHash ? 1 : -1;
  if (playerIndex < 0) return { error: Response.json({ error: "房間憑證無效，請重新加入。" }, { status: 403 }) } as const;
  return { row, playerIndex } as const;
}
