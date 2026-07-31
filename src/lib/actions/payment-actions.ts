"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sum, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, splits, payments, people } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import { parseAmountToCents } from "@/lib/utils";

export type PaymentActionState = { error: string | null };

async function txnInProject(projectId: string, txnId: string) {
  await requireProject(projectId);
  const txn = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, txnId), eq(transactions.projectId, projectId)))
    .get();
  if (!txn) return { error: "Transaction not found in this project", txn: null };
  return { error: null as string | null, txn };
}

export async function recordPaymentAction(
  projectId: string,
  txnId: string,
  formData: FormData,
): Promise<PaymentActionState>;
export async function recordPaymentAction(
  projectId: string,
  txnId: string,
  prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState>;
export async function recordPaymentAction(
  projectId: string,
  txnId: string,
  a: PaymentActionState | FormData,
  b?: FormData,
): Promise<PaymentActionState> {
  const formData = b ?? (a as FormData);
  const t = await txnInProject(projectId, txnId);
  if (t.error || !t.txn) return { error: t.error };

  const personId = String(formData.get("personId") ?? "");
  const amountInput = String(formData.get("amount") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const paidAtRaw = String(formData.get("paidAt") ?? "");

  if (!personId) return { error: "Pick a person." };

  const projectPeople = await db
    .select()
    .from(people)
    .where(eq(people.projectId, projectId))
    .all();
  if (!projectPeople.some((p) => p.id === personId)) {
    return { error: "That person is not part of this project." };
  }

  let amount: number;
  try {
    amount = parseAmountToCents(amountInput);
  } catch {
    return { error: "Enter a valid amount." };
  }
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  const paidAt = paidAtRaw ? new Date(paidAtRaw).getTime() : Date.now();
  if (Number.isNaN(paidAt)) return { error: "Invalid date." };

  const splitForPerson = await db
    .select()
    .from(splits)
    .where(and(eq(splits.transactionId, txnId), eq(splits.personId, personId)))
    .get();
  if (!splitForPerson) return { error: "That person isn't part of this transaction." };

  if (note.length > 200) return { error: "Note too long." };

  await db.insert(payments).values({
    transactionId: txnId,
    personId,
    amountCents: amount,
    note: note || null,
    paidAt: new Date(paidAt),
  });

  revalidatePath(`/projects/${projectId}/transactions/${txnId}`);
  return { error: null };
}

export async function markFullyPaidAction(
  projectId: string,
  txnId: string,
  personId: string,
): Promise<PaymentActionState> {
  const t = await txnInProject(projectId, txnId);
  if (t.error || !t.txn) return { error: t.error };

  const split = await db
    .select()
    .from(splits)
    .where(and(eq(splits.transactionId, txnId), eq(splits.personId, personId)))
    .get();
  if (!split) return { error: "Not a participant in this transaction." };

  const sumRow = await db
    .select({ total: sum(payments.amountCents) })
    .from(payments)
    .where(and(eq(payments.transactionId, txnId), eq(payments.personId, personId)))
    .get();
  const paid = Number(sumRow?.total ?? 0);
  const remaining = split.owedAmountCents - paid;
  if (remaining <= 0) return { error: null };

  await db.insert(payments).values({
    transactionId: txnId,
    personId,
    amountCents: remaining,
    note: "Marked as paid",
    paidAt: new Date(),
  });

  revalidatePath(`/projects/${projectId}/transactions/${txnId}`);
  return { error: null };
}

export async function deletePaymentAction(
  projectId: string,
  txnId: string,
  paymentId: string,
): Promise<PaymentActionState> {
  const t = await txnInProject(projectId, txnId);
  if (t.error || !t.txn) return { error: t.error };

  await db
    .delete(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.transactionId, txnId)));
  revalidatePath(`/projects/${projectId}/transactions/${txnId}`);
  return { error: null };
}

export type SettleUpAllocation = {
  transactionId: string;
  transactionTitle: string;
  amountCents: number;
};

export type SettleUpResult = {
  error: string | null;
  allocations: SettleUpAllocation[];
};

/**
 * "Settle up" CTA from the project overview.
 *
 * Greedy cascade: distribute `cents` across every underlying (transaction,
 * fromPerson) split where `toPerson` is the payer. Each split receives a
 * fresh `payments` row sized to clear all or part of its remaining debt.
 *
 * Why cascade instead of writing a single synthetic payment:
 *   - The existing schema anchors payments to (transaction, person) pairs,
 *     which keeps the recent-transaction card and per-person payment
 *     history correctly reflecting the cleared debt without a migration.
 *   - The cascade handles the common case where the simplified settlement
 *     amount does not exactly match any single split (Bob borrowed ₹100
 *     from Alice on txn A and ₹320 on txn B; settling ₹420 clears both).
 *
 * Allocation order: largest remaining split first. This matches user
 * intuition ("clear the big one first") and creates the fewest rows
 * needed for a given settlement amount.
 */
export async function settleUpAction(
  projectId: string,
  fromPersonId: string,
  toPersonId: string,
  cents: number,
): Promise<SettleUpResult> {
  if (!Number.isFinite(cents) || cents <= 0) {
    return { error: "Settlement amount must be greater than zero.", allocations: [] };
  }
  if (fromPersonId === toPersonId) {
    return { error: "From and to must be different people.", allocations: [] };
  }
  await requireProject(projectId);

  const projectPeople = await db
    .select()
    .from(people)
    .where(eq(people.projectId, projectId))
    .all();
  if (!projectPeople.some((p) => p.id === fromPersonId)) {
    return { error: "From-person is not part of this project.", allocations: [] };
  }
  if (!projectPeople.some((p) => p.id === toPersonId)) {
    return { error: "To-person is not part of this project.", allocations: [] };
  }

  // Load transactions where toPerson is the payer.
  const payerTxns = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        eq(transactions.paidById, toPersonId),
      ),
    )
    .orderBy(desc(transactions.occurredAt))
    .all();

  if (payerTxns.length === 0) {
    return {
      error: "Nothing to settle \u2014 the to-person hasn't paid for any transactions in this project.",
      allocations: [],
    };
  }

  const txnIds = payerTxns.map((t) => t.id);
  const txnById = new Map(payerTxns.map((t) => [t.id, t]));

  // Splits where fromPerson owes on these transactions.
  const fromSplits = await db
    .select()
    .from(splits)
    .where(
      and(
        inArray(splits.transactionId, txnIds),
        eq(splits.personId, fromPersonId),
      ),
    )
    .all();

  if (fromSplits.length === 0) {
    return {
      error: "Nothing to settle \u2014 the from-person didn't owe the to-person on any transaction.",
      allocations: [],
    };
  }

  // Sum payments already recorded per (transaction, fromPerson) pair.
  const fromPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        inArray(payments.transactionId, txnIds),
        eq(payments.personId, fromPersonId),
      ),
    )
    .all();

  const paidByTxn = new Map<string, number>();
  for (const p of fromPayments) {
    paidByTxn.set(p.transactionId, (paidByTxn.get(p.transactionId) ?? 0) + p.amountCents);
  }

  // Compute remaining debt per split and keep only the positive ones.
  type Debt = {
    transactionId: string;
    transactionTitle: string;
    remainingCents: number;
  };
  const debts: Debt[] = fromSplits
    .map((s) => {
      const paid = paidByTxn.get(s.transactionId) ?? 0;
      const remaining = s.owedAmountCents - paid;
      return {
        transactionId: s.transactionId,
        transactionTitle: txnById.get(s.transactionId)?.title ?? "Untitled",
        remainingCents: remaining,
      };
    })
    .filter((d) => d.remainingCents > 0);

  if (debts.length === 0) {
    return {
      error: "Nothing to settle \u2014 all underlying transactions are already paid.",
      allocations: [],
    };
  }

  const totalUnderlying = debts.reduce((s, d) => s + d.remainingCents, 0);
  if (cents > totalUnderlying) {
    return {
      error: "Cannot settle more than the remaining total debt.",
      allocations: [],
    };
  }

  // Greedy cascade: largest remaining debt first. Re-sort each iteration
  // because the largest may shrink below the next candidate.
  const allocations: SettleUpAllocation[] = [];
  let amountLeft = cents;
  const paidAt = new Date();
  while (amountLeft > 0) {
    debts.sort((a, b) => b.remainingCents - a.remainingCents);
    const next = debts[0]!;
    if (next.remainingCents <= 0) break;
    const allocate = Math.min(next.remainingCents, amountLeft);
    await db.insert(payments).values({
      transactionId: next.transactionId,
      personId: fromPersonId,
      amountCents: allocate,
      note: "Settled up",
      paidAt,
    });
    allocations.push({
      transactionId: next.transactionId,
      transactionTitle: next.transactionTitle,
      amountCents: allocate,
    });
    next.remainingCents -= allocate;
    amountLeft -= allocate;
  }

  revalidatePath(`/projects/${projectId}`);
  return { error: null, allocations };
}
