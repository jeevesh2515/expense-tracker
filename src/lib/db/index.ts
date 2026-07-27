import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

/**
 * DB client.
 *
 * In production, points at Turso over HTTPS. In development, falls back to a
 * local on-disk SQLite file (libsql's local "file:" mode), preserving the
 * same `./data/expense-tracker.db` path the app used before. The libsql driver
 * is pure JavaScript over HTTP, so it works on serverless platforms like
 * Vercel where the filesystem is read-only / ephemeral.
 */
const rawUrl = process.env.TURSO_DATABASE_URL?.trim();
const url =
  rawUrl && (rawUrl.startsWith("libsql://") || rawUrl.startsWith("https://") || rawUrl.startsWith("file:"))
    ? rawUrl
    : `file:${process.env.DATABASE_LOCAL_PATH ?? "./data/expense-tracker.db"}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

// Local dev only: make sure the parent directory exists for the sqlite file.
if (url.startsWith("file:")) {
  const localPath = url.slice("file:".length);
  mkdirSync(dirname(localPath), { recursive: true });
}

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
/** Raw client used by ensureSchema() for multi-statement raw SQL execution. */
export const rawDb = client;
export { schema };
