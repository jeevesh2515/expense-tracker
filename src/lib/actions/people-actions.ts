"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { people, projects, transactions, splits, payments } from "@/lib/db/schema";
import { requireUser } from "@/lib/server-utils";
import { AVATAR_PALETTE } from "@/lib/utils";

export type PeopleActionState = { error: string | null };

async function getOwnedProject(projectId: string) {
  const user = await requireUser();
  const proj = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .get();
  if (!proj) throw new Error("Project not found");
  return proj;
}

function nextColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export async function createPersonAction(
  projectId: string,
  _prevState: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  await getOwnedProject(projectId);
  const name = String(formData.get("name") ?? "").trim();
  const isMe = formData.get("isMe") === "on";

  if (name.length < 1 || name.length > 80) {
    return { error: "Name is required (1–80 chars)." };
  }

  if (isMe) {
    const existing = await db
      .select()
      .from(people)
      .where(eq(people.projectId, projectId))
      .all();
    for (const p of existing) {
      if (p.isMe) {
        await db.update(people).set({ isMe: false }).where(eq(people.id, p.id));
      }
    }
  }
  await db.insert(people).values({
    projectId,
    name,
    colorHex: nextColor(projectId + name),
    isMe,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/people`);
  return { error: null };
}

export async function updatePersonAction(
  projectId: string,
  personId: string,
  _prevState: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  await getOwnedProject(projectId);
  const name = String(formData.get("name") ?? "").trim();
  const colorHex = String(formData.get("colorHex") ?? "#6366f1").trim();
  const isMe = formData.get("isMe") === "on";

  if (name.length < 1 || name.length > 80) {
    return { error: "Name is required (1–80 chars)." };
  }

  if (isMe) {
    const existing = await db
      .select()
      .from(people)
      .where(eq(people.projectId, projectId))
      .all();
    for (const p of existing) {
      if (p.isMe && p.id !== personId) {
        await db.update(people).set({ isMe: false }).where(eq(people.id, p.id));
      }
    }
  }

  await db
    .update(people)
    .set({ name, colorHex, isMe })
    .where(and(eq(people.id, personId), eq(people.projectId, projectId)));

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/people`);
  return { error: null };
}

export async function deletePersonAction(
  projectId: string,
  personId: string,
): Promise<PeopleActionState> {
  await getOwnedProject(projectId);
  // Splits & payments both FK to people with ON DELETE RESTRICT, so the DB
  // will throw on a raw `db.delete(people)` if this person participated in
  // any past transaction. Pre-check all three tables and surface a friendly
  // error so the user knows exactly what to clean up first.
  //
  // Splits and payments don't carry project_id directly; we scope the
  // counts to the current project via the transactions table, so people
  // who happened to share a person_id across projects don't trip a false
  // positive. (In practice person IDs are unique per record and the join
  // makes the error message accurate and project-scoped.)
  const projectTxnIds = (
    await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.projectId, projectId))
      .all()
  ).map((t) => t.id);

  const [usedAsPayer, inSplits, inPayments] = await Promise.all([
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.projectId, projectId),
          eq(transactions.paidById, personId),
        ),
      )
      .all(),
    projectTxnIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: splits.id })
          .from(splits)
          .where(
            and(
              eq(splits.personId, personId),
              inArray(splits.transactionId, projectTxnIds),
            ),
          )
          .all(),
    projectTxnIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: payments.id })
          .from(payments)
          .where(
            and(
              eq(payments.personId, personId),
              inArray(payments.transactionId, projectTxnIds),
            ),
          )
          .all(),
  ]);

  if (usedAsPayer.length > 0) {
    return {
      error: `This person has paid for ${usedAsPayer.length} transaction${
        usedAsPayer.length === 1 ? "" : "s"
      }. Delete or reassign ${
        usedAsPayer.length === 1 ? "that transaction" : "those transactions"
      } first.`,
    };
  }
  if (inSplits.length > 0 || inPayments.length > 0) {
    const total = inSplits.length + inPayments.length;
    return {
      error: `This person has ${total} past record${
        total === 1 ? "" : "s"
      } (splits or payments) in this project. To preserve history, ${
        total === 1 ? "this person can't be deleted" : "they can't be deleted"
      } — try renaming instead, or delete the underlying transactions first.`,
    };
  }

  try {
    await db
      .delete(people)
      .where(and(eq(people.id, personId), eq(people.projectId, projectId)));
  } catch (err) {
    // Defense-in-depth: if a FK constraint still trips (race condition,
    // schema inconsistency), surface a graceful error rather than 500.
    console.error("deletePersonAction failed:", err);
    return {
      error:
        "Couldn't delete this person because of existing references. Try removing them from transactions first.",
    };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/people`);
  return { error: null };
}
