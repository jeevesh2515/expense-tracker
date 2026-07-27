"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { people, projects, transactions } from "@/lib/db/schema";
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
  const usedAsPayer = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.projectId, projectId), eq(transactions.paidById, personId)))
    .all();
  if (usedAsPayer.length > 0) {
    return {
      error:
        "This person is the payer on one or more transactions — delete or change those first.",
    };
  }
  await db
    .delete(people)
    .where(and(eq(people.id, personId), eq(people.projectId, projectId)));
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/people`);
  return { error: null };
}
