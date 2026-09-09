import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    usernameNormalized: text("username_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("users_username_normalized_unique").on(table.usernameNormalized)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const decks = sqliteTable(
  "decks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    deckJson: text("deck_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("decks_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const simRooms = sqliteTable(
  "sim_rooms",
  {
    code: text("code").primaryKey(),
    hostTokenHash: text("host_token_hash").notNull(),
    guestTokenHash: text("guest_token_hash"),
    stateJson: text("state_json").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("sim_rooms_expires_idx").on(table.expiresAt)],
);
