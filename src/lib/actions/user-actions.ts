"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, projects, people, transactions, splits, payments } from "@/lib/db/schema";
import { requireUser } from "@/lib/server-utils";

export type UserActionState = { error: string | null };

export async function updateProfileAction(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 1) {
    return { error: "Name is required." };
  }
  if (name.length > 80) {
    return { error: "Name too long (max 80 chars)." };
  }

  await db
    .update(users)
    .set({ name })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function changePasswordAction(
  _prevState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const user = await requireUser();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }

  // Verify current password
  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .get();
  if (!userRecord) return { error: "User not found." };

  const valid = await bcrypt.compare(currentPassword, userRecord.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  if (currentPassword === newPassword) {
    return { error: "New password must be different from current password." };
  }

  // Update password
  const newHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  return { error: null };
}

export async function deleteAccountAction(): Promise<{ error: string | null }> {
  const user = await requireUser();

  // Delete in order to respect foreign key constraints
  // payments → splits → transactions → people → projects → user
  const userProjectIds = (await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, user.id))
    .all()).map((p) => p.id);

  if (userProjectIds.length > 0) {
    // Get all transaction IDs for user's projects
    const txnIds = (await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(inArray(transactions.projectId, userProjectIds))
      .all()).map((t) => t.id);

    // Delete payments
    if (txnIds.length > 0) {
      await db.delete(payments).where(inArray(payments.transactionId, txnIds));
      await db.delete(splits).where(inArray(splits.transactionId, txnIds));
      await db.delete(transactions).where(inArray(transactions.id, txnIds));
    }

    // Delete people and projects
    await db.delete(people).where(inArray(people.projectId, userProjectIds));
    await db.delete(projects).where(eq(projects.userId, user.id));
  }

  await db.delete(users).where(eq(users.id, user.id));
  return { error: null };
}
