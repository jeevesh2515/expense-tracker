import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, people } from "@/lib/db/schema";
import { requireUser } from "@/lib/server-utils";
import { ProjectTabs } from "@/components/ProjectTabs";
import { ProjectSettingsButton } from "@/components/ProjectSettingsButton";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const user = await requireUser();
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, user.id)))
    .get();
  if (!project) notFound();

  const projectPeople = await db
    .select()
    .from(people)
    .where(eq(people.projectId, project.id))
    .all();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-3"
        >
          ← All projects
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1>{project.name}</h1>
              <span className="badge badge-brand">{project.currencyCode}</span>
            </div>
            {project.description && (
              <p className="text-sm text-gray-600 max-w-3xl">{project.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {projectPeople.length} {projectPeople.length === 1 ? "person" : "people"} ·{" "}
              {projectPeople.length > 0 ? "Ready to add transactions" : "Add people to begin"}
            </p>
          </div>
          <ProjectSettingsButton
            projectId={project.id}
            projectName={project.name}
            projectDescription={project.description ?? ""}
          />
        </div>
      </div>

      <ProjectTabs projectId={project.id} />

      <div>{children}</div>
    </div>
  );
}
