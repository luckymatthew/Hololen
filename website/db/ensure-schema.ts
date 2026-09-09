import { getD1 } from ".";

let schemaReady: Promise<unknown> | null = null;

export function ensureSchema() {
  if (schemaReady) return schemaReady;
  const d1 = getD1();
  schemaReady = d1.batch([
    d1.prepare("CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY NOT NULL, username text NOT NULL, username_normalized text NOT NULL, password_hash text NOT NULL, password_salt text NOT NULL, created_at integer NOT NULL)"),
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_username_normalized_unique ON users (username_normalized)"),
    d1.prepare("CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at integer NOT NULL, created_at integer NOT NULL)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)"),
    d1.prepare("CREATE TABLE IF NOT EXISTS decks (id text PRIMARY KEY NOT NULL, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, name text NOT NULL, deck_json text NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS decks_user_updated_idx ON decks (user_id, updated_at)"),
    d1.prepare("CREATE TABLE IF NOT EXISTS sim_rooms (code text PRIMARY KEY NOT NULL, host_token_hash text NOT NULL, guest_token_hash text, state_json text NOT NULL, version integer DEFAULT 1 NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL, expires_at integer NOT NULL)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS sim_rooms_expires_idx ON sim_rooms (expires_at)"),
  ]).catch((error: unknown) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}
