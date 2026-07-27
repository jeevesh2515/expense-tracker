/**
 * Light-weight schema bootstrap. We avoid drizzle-kit at runtime to keep the
 * dependency surface small and the bootstrap deterministic across machines.
 *
 * Idempotent: uses `CREATE TABLE IF NOT EXISTS` and can be run any number of
 * times without error.
 *
 * `executeMultiple` runs the script in one round-trip over libsql's HTTP
 * protocol, so SQLite idioms (`unixepoch() * 1000`, `CHECK (col IN (...))`,
 * `INTEGER` for booleans) all pass through unchanged.
 */
import { rawDb } from "./index";

export async function ensureSchema() {
  await rawDb.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      currency_code TEXT NOT NULL DEFAULT 'INR',
      currency_symbol TEXT NOT NULL DEFAULT '₹',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS projects_user_idx ON projects(user_id);

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color_hex TEXT NOT NULL DEFAULT '#6366f1',
      is_me INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS people_project_idx ON people(project_id);

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      paid_by_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      total_amount_cents INTEGER NOT NULL,
      currency_code TEXT NOT NULL,
      currency_symbol TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS transactions_project_idx ON transactions(project_id);
    CREATE INDEX IF NOT EXISTS transactions_occurred_at_idx ON transactions(occurred_at);

    CREATE TABLE IF NOT EXISTS splits (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      share_type TEXT NOT NULL CHECK (share_type IN ('equal','exact','percentage')),
      share_value INTEGER NOT NULL DEFAULT 0,
      owed_amount_cents INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS splits_txn_idx ON splits(transaction_id);
    CREATE INDEX IF NOT EXISTS splits_person_idx ON splits(person_id);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
      amount_cents INTEGER NOT NULL,
      note TEXT,
      paid_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS payments_txn_idx ON payments(transaction_id);
    CREATE INDEX IF NOT EXISTS payments_person_idx ON payments(person_id);
  `);
}

if (require.main === module) {
  ensureSchema().then(
    () => console.log("✔ schema ready"),
    (err: unknown) => {
      console.error("✘ schema bootstrap failed", err);
      process.exit(1);
    },
  );
}
