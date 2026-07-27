import type { Config } from "drizzle-kit";

const rawUrl = process.env.TURSO_DATABASE_URL?.trim();
const url =
  rawUrl && (rawUrl.startsWith("libsql://") || rawUrl.startsWith("https://") || rawUrl.startsWith("file:"))
    ? rawUrl
    : `file:${process.env.DATABASE_LOCAL_PATH ?? "./data/expense-tracker.db"}`;

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
