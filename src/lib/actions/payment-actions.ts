"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sum } from "drizzle-orm";
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
