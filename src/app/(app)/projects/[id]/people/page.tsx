import { eq } from "drizzle-orm";
import { UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { people } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { NewPersonForm } from "@/components/NewPersonForm";
import { DeletePersonButton } from "@/components/DeletePersonButton";

export const dynamic = "force-dynamic";

export default async function PeoplePage({ params }: { params: { id: string } }) {
  const project = await requireProject(params.id);
  const projectPeople = await db
    .select()
    .from(people)
    .where(eq(people.projectId, project.id))
    .all();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <h3 className="font-semibold">
            People in this project ({projectPeople.length})
          </h3>
        </CardHeader>
        <CardBody>
          {projectPeople.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No one yet. Add someone on the right.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {projectPeople.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={p.name} color={p.colorHex} />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate flex items-center gap-2">
                        {p.name}
                        {p.isMe && (
                          <span className="badge badge-brand text-[10px] py-0">you</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {p.colorHex.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <DeletePersonButton
                    projectId={project.id}
                    personId={p.id}
                    personName={p.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add a person
          </h3>
        </CardHeader>
        <CardBody>
          <NewPersonForm projectId={project.id} />
        </CardBody>
      </Card>
    </div>
  );
}
