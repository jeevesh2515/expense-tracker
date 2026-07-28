import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

const now = () => sql`(unixepoch() * 1000)`;

/**
 * Users: each account belongs to one human sign-in.
 */
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(now()),
});

/**
 * Projects: an isolated expense container (e.g. "Tokyo Trip 2026").
 * Each project has its own people, transactions, currency, and balances.
 */
export const projects = sqliteTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    currencyCode: text("currency_code").notNull().default("INR"),
    currencySymbol: text("currency_symbol").notNull().default("₹"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now()),
  },
  (t) => ({
    userIdx: index("projects_user_idx").on(t.userId),
  }),
);

/**
 * People in a project (e.g. "Alice", "Bob", "Me").
 * Scoped per-project. One person per project is flagged as `isMe`.
 */
export const people = sqliteTable(
  "people",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colorHex: text("color_hex").notNull().default("#6366f1"),
    isMe: integer("is_me", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now()),
  },
  (t) => ({
    projectIdx: index("people_project_idx").on(t.projectId),
  }),
);

/**
 * Transactions: a single expense event in a project. Paid by one person;
 * total amount in cents; splits in child table.
 */
export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    paidById: text("paid_by_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    totalAmountCents: integer("total_amount_cents").notNull(),
    currencyCode: text("currency_code").notNull(),
    currencySymbol: text("currency_symbol").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    receiptImage: text("receipt_image"), // base64 data URL of scanned receipt
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now()),
  },
  (t) => ({
    projectIdx: index("transactions_project_idx").on(t.projectId),
    occurredAtIdx: index("transactions_occurred_at_idx").on(t.occurredAt),
  }),
);

/**
 * Splits: how much each person owes for a given transaction.
 *
 * Share rules:
 *   - shareType="equal": shareValue ignored; owedAmountCents computed by splitter.
 *   - shareType="exact": shareValue = the exact cents for this person.
 *   - shareType="percentage": shareValue = basis points (0..10000; 10000 = 100%).
 *
 * `owedAmountCents` is the canonical value used in all downstream math.
 */
export const splits = sqliteTable(
  "splits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    shareType: text("share_type", {
      enum: ["equal", "exact", "percentage"],
    }).notNull(),
    /**
     * For `exact`: the exact cents this person owes.
     * For `percentage`: basis points (1 bp = 0.01%, 10000 bp = 100%).
     * For `equal`: unused (kept 0 for portability).
     */
    shareValue: integer("share_value").notNull().default(0),
    owedAmountCents: integer("owed_amount_cents").notNull(),
  },
  (t) => ({
    txnIdx: index("splits_txn_idx").on(t.transactionId),
    personIdx: index("splits_person_idx").on(t.personId),
  }),
);

/**
 * Payments: each row is a payment event against a (transaction, person) pair.
 * Multiple rows per pair = partial payments over time. Sum of amount_cents
 * across rows = how much that person has paid for that transaction.
 */
export const payments = sqliteTable(
  "payments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(now()),
  },
  (t) => ({
    txnIdx: index("payments_txn_idx").on(t.transactionId),
    personIdx: index("payments_person_idx").on(t.personId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Split = typeof splits.$inferSelect;
export type NewSplit = typeof splits.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
