"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireUser } from "@/lib/server-utils";
import { DEFAULT_CURRENCY } from "@/lib/utils";

export type ProjectActionState = { error: string | null };

// Direct call: `createProjectAction(formData)` — used via form action= prop.
export async function createProjectAction(
  formData: FormData,
): Promise<ProjectActionState>;
// useFormState call: `createProjectAction(prevState, formData)`.
export async function createProjectAction(
  prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState>;
export async function createProjectAction(
  a: ProjectActionState | FormData,
  b?: FormData,
): Promise<ProjectActionState> {
  const formData = b ?? (a as FormData);
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 1 || name.length > 120) {
    return { error: "Project name is required (1–120 chars)." };
  }
  if (description.length > 500) {
    return { error: "Description too long (max 500 chars)." };
  }

  const inserted = await db
    .insert(projects)
    .values({
      userId: user.id,
      name,
      description: description || null,
      currencyCode: DEFAULT_CURRENCY.code,
      currencySymbol: DEFAULT_CURRENCY.symbol,
    })
    .returning()
    .get();

  revalidatePath("/dashboard");
  redirect(`/projects/${inserted.id}`);
}

// Overloads for `updateProjectAction(projectId, …)`.
export async function updateProjectAction(
  projectId: string,
  formData: FormData,
): Promise<ProjectActionState>;
export async function updateProjectAction(
  projectId: string,
  prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState>;
export async function updateProjectAction(
  projectId: string,
  a: ProjectActionState | FormData,
  b?: FormData,
): Promise<ProjectActionState> {
  const formData = b ?? (a as FormData);
  const user = await requireUser();
  const owned = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .get();
  if (!owned) return { error: "Project not found" };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 1 || name.length > 120) {
    return { error: "Project name required (1–120 chars)." };
  }
  if (description.length > 500) {
    return { error: "Description too long (max 500 chars)." };
  }

  await db
    .update(projects)
    .set({
      name,
      description: description || null,
      // Currency is locked to ₹ across the app; ignore any stray field.
      currencyCode: DEFAULT_CURRENCY.code,
      currencySymbol: DEFAULT_CURRENCY.symbol,
    })
    .where(eq(projects.id, projectId));

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  const user = await requireUser();
  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)));
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
