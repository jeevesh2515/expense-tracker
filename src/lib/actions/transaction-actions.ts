"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, people, transactions, splits } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import { computeSplits, type ShareType } from "@/lib/calculations";
import { parseAmountToCents } from "@/lib/utils";

const TitleSchema = z.string().min(1).max(120);
const ParticipantInput = z.object({
  personId: z.string().min(1),
  value: z.number().int().min(0).optional(),
});

export type TransactionActionState = { error: string | null };

async function loadProjectContext(projectId: string) {
  const project = await requireProject(projectId);
  const allPeople = await db
    .select()
    .from(people)
    .where(eq(people.projectId, projectId))
    .all();
  return { project, allPeople };
}

type BuiltParticipants =
  | { ok: true; allPeople: typeof people.$inferSelect[]; computed: Array<{ personId: string; name: string; value: number }> }
  | { ok: false; error: string };

async function buildParticipants(projectId: string, raw: string): Promise<BuiltParticipants> {
  const { allPeople } = await loadProjectContext(projectId);
  const personIds = new Set(allPeople.map((p) => p.id));
  let parsed: Array<{ personId: string; value?: number }>;
  try {
    parsed = z.array(ParticipantInput).parse(JSON.parse(raw));
  } catch {
    return { ok: false, error: "Invalid participants input." };
  }
  for (const p of parsed) {
    if (!personIds.has(p.personId)) {
      return { ok: false, error: "Unknown participant in this project." };
    }
  }
  if (parsed.length === 0) return { ok: false, error: "Pick at least one participant." };
  return {
    ok: true,
    allPeople,
    computed: parsed.map((p) => ({
      personId: p.personId,
      name: allPeople.find((x) => x.id === p.personId)?.name ?? "?",
      value: p.value ?? 0,
    })),
  };
}

// Overloads — direct call vs useFormState.
export async function createTransactionAction(
  projectId: string,
  formData: FormData,
): Promise<TransactionActionState>;
export async function createTransactionAction(
  projectId: string,
  prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState>;
export async function createTransactionAction(
  projectId: string,
  a: TransactionActionState | FormData,
  b?: FormData,
): Promise<TransactionActionState> {
  const formData = b ?? (a as FormData);
  const { project } = await loadProjectContext(projectId);

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const totalInput = String(formData.get("totalAmount") ?? "").trim();
  const paidById = String(formData.get("paidById") ?? "");
  const occurredAtRaw = String(formData.get("occurredAt") ?? "");
  const shareType = String(formData.get("shareType") ?? "equal") as ShareType;
  const participantsRaw = String(formData.get("participants") ?? "[]");

  const t = TitleSchema.safeParse(title);
  if (!t.success) return { error: "Title required (1–120 chars)." };
  if (!paidById) return { error: "Pick who paid for this transaction." };
  let totalCents: number;
  try {
    totalCents = parseAmountToCents(totalInput);
  } catch {
    return { error: "Enter a valid total amount (e.g. 12.34)." };
  }
  if (totalCents <= 0) return { error: "Total must be greater than zero." };
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw).getTime() : Date.now();
  if (Number.isNaN(occurredAt)) return { error: "Invalid date." };
  if (!["equal", "exact", "percentage"].includes(shareType)) {
    return { error: "Invalid share type." };
  }

  const built = await buildParticipants(projectId, participantsRaw);
  if (!built.ok) return { error: built.error };
  if (!built.allPeople.some((p) => p.id === paidById)) {
    return { error: "Payer is not part of this project." };
  }

  let computedSplits;
  try {
    computedSplits = computeSplits(totalCents, shareType, built.computed);
  } catch (err) {
    return { error: (err as Error).message };
  }

  // Atomic insert (libsql transactions are async; every inner call is awaited).
  const newId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(transactions)
      .values({
        projectId,
        paidById,
        title: t.data,
        description: description || null,
        category: category || null,
        totalAmountCents: totalCents,
        currencyCode: project.currencyCode,
        currencySymbol: project.currencySymbol,
        occurredAt: new Date(occurredAt),
      })
      .returning()
      .get();
    for (const s of computedSplits) {
      await tx.insert(splits).values({
        transactionId: inserted.id,
        personId: s.personId,
        shareType: s.shareType,
        shareValue: s.shareValue,
        owedAmountCents: s.owedAmountCents,
      });
    }
    return inserted.id;
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/transactions`);
  redirect(`/projects/${projectId}/transactions/${newId}`);
}

// Overloads.
export async function updateTransactionAction(
  projectId: string,
  txnId: string,
  formData: FormData,
): Promise<TransactionActionState>;
export async function updateTransactionAction(
  projectId: string,
  txnId: string,
  prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState>;
export async function updateTransactionAction(
  projectId: string,
  txnId: string,
  a: TransactionActionState | FormData,
  b?: FormData,
): Promise<TransactionActionState> {
  const formData = b ?? (a as FormData);
  const { project } = await loadProjectContext(projectId);

  const txn = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, txnId), eq(transactions.projectId, projectId)))
    .get();
  if (!txn) return { error: "Transaction not found" };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const totalInput = String(formData.get("totalAmount") ?? "").trim();
  const paidById = String(formData.get("paidById") ?? "");
  const occurredAtRaw = String(formData.get("occurredAt") ?? "");
  const shareType = String(formData.get("shareType") ?? "equal") as ShareType;
  const participantsRaw = String(formData.get("participants") ?? "[]");

  const t = TitleSchema.safeParse(title);
  if (!t.success) return { error: "Title required (1–120 chars)." };
  if (!paidById) return { error: "Pick who paid." };
  let totalCents: number;
  try {
    totalCents = parseAmountToCents(totalInput);
  } catch {
    return { error: "Enter a valid total amount." };
  }
  if (totalCents <= 0) return { error: "Total must be greater than zero." };
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw).getTime() : Date.now();
  if (Number.isNaN(occurredAt)) return { error: "Invalid date." };

  const built = await buildParticipants(projectId, participantsRaw);
  if (!built.ok) return { error: built.error };
  if (!built.allPeople.some((p) => p.id === paidById)) {
    return { error: "Payer is not part of this project." };
  }

  let computedSplits;
  try {
    computedSplits = computeSplits(totalCents, shareType, built.computed);
  } catch (err) {
    return { error: (err as Error).message };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(transactions)
      .set({
        paidById,
        title: t.data,
        description: description || null,
        category: category || null,
        totalAmountCents: totalCents,
        occurredAt: new Date(occurredAt),
      })
      .where(eq(transactions.id, txnId))
      .run();
    await tx.delete(splits).where(eq(splits.transactionId, txnId)).run();
    for (const s of computedSplits) {
      await tx.insert(splits).values({
        transactionId: txnId,
        personId: s.personId,
        shareType: s.shareType,
        shareValue: s.shareValue,
        owedAmountCents: s.owedAmountCents,
      });
    }
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/transactions`);
  revalidatePath(`/projects/${projectId}/transactions/${txnId}`);
  return { error: null };
}

export async function deleteTransactionAction(
  projectId: string,
  txnId: string,
): Promise<void> {
  await requireProject(projectId);
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, txnId), eq(transactions.projectId, projectId)));
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/transactions`);
  redirect(`/projects/${projectId}/transactions`);
}
