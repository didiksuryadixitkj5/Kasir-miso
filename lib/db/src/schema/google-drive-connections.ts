import { timestamp, text, uuid, pgTable } from "drizzle-orm/pg-core";

export const googleDriveConnectionsTable = pgTable("google_drive_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionTokenHash: text("session_token_hash").notNull().unique(),
  deviceIdHash: text("device_id_hash"),
  sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).defaultNow().notNull(),
  googleSubject: text("google_subject").notNull(),
  email: text("email").notNull(),
  googleClientId: text("google_client_id").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type GoogleDriveConnection = typeof googleDriveConnectionsTable.$inferSelect;