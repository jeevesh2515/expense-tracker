import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { db } from "./db";
import { users, projects, type User, type Project } from "./db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ensureSchema } from "./db/migrate";

/**
 * Ensure schema is bootstrapped exactly once per server-process boot.
 * Called implicitly by route handlers entering through getCurrentUser.
 */
let schemaReady = false;
export async function bootstrapSchema() {
  if (schemaReady) return;
  await ensureSchema();
  schemaReady = true;
}

export async function getCurrentUser(): Promise<User | null> {
  await bootstrapSchema();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();
  return user ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Fetch a project and verify the current user owns it.
 * Redirects away on failure (auth or ownership).
 */
export async function requireProject(projectId: string): Promise<Project> {
  const user = await requireUser();
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .get();
  if (!project) redirect("/dashboard");
  return project;
}

export class FormError extends Error {
  constructor(public field: string, message: string) {
    super(message);
  }
}
