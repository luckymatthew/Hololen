import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureSchema } from "@/db/ensure-schema";
import { sessions, users } from "@/db/schema";

const COOKIE_NAME = "holodeck_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
// Cloudflare Workers currently supports PBKDF2 iteration counts up to 100,000.
const PBKDF2_ITERATIONS = 100_000;

export type AccountUser = { id: string; username: string };

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function derivePassword(password: string, salt: Uint8Array) {
  const saltBuffer = new Uint8Array(salt).buffer;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return null;
}

function sessionCookie(request: Request, token: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function validateAccountInput(usernameInput: unknown, passwordInput: unknown) {
  const username = typeof usernameInput === "string" ? usernameInput.trim() : "";
  const password = typeof passwordInput === "string" ? passwordInput : "";
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(username)) {
    return { error: "使用者名稱需為 3–24 個英文字母、數字、底線或連字號。" } as const;
  }
  if (password.length < 8 || password.length > 128) {
    return { error: "密碼需為 8–128 個字元。" } as const;
  }
  return { username, usernameNormalized: username.toLocaleLowerCase("en-US"), password } as const;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { passwordHash: await derivePassword(password, salt), passwordSalt: bytesToBase64Url(salt) };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actualHash = await derivePassword(password, base64UrlToBytes(salt));
  return constantTimeEqual(actualHash, expectedHash);
}

export async function issueSession(request: Request, userId: string) {
  await ensureSchema();
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await getDb().insert(sessions).values({
    tokenHash: await sha256(token),
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  });
  return sessionCookie(request, token, SESSION_TTL_SECONDS);
}

export async function getSessionUser(request: Request): Promise<AccountUser | null> {
  await ensureSchema();
  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;
  const [row] = await getDb()
    .select({ id: users.id, username: users.username })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, await sha256(token)), gt(sessions.expiresAt, Date.now())))
    .limit(1);
  return row ?? null;
}

export async function revokeSession(request: Request) {
  await ensureSchema();
  const token = readCookie(request, COOKIE_NAME);
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
  return sessionCookie(request, "", 0);
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
