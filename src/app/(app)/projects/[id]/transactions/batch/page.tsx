import Link from "next/link";
import { eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { people } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { BatchTransactionClient } from "@/components/BatchTransactionClient";

export const dynamic = "force-dynamic";

export default async function BatchTransactionPage({
  params,
}: {
  params: { id: string };
}) {
  const project = await requireProject(params.id);
  const projectPeople = await db
    .select()
    .from(people)
    .where(eq(people.projectId, project.id))
    .all();
  const me = projectPeople.find((p) => p.isMe);

  if (projectPeople.length === 0) {
    return (
      <Card>
        <CardBody>
          <div className="text-center py-8">
            <h3 className="mb-2">No people yet</h3>
            <p className="text-gray-500 mb-4">
              You need at least one person before adding transactions.
            </p>
            <Link href={`/projects/${project.id}/people`} className="text-brand-600 font-medium">
              Add people →
            </Link>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <BatchTransactionClient
      projectId={project.id}
      projectName={project.name}
      currencyCode={project.currencyCode}
      currencySymbol={project.currencySymbol}
      people={projectPeople.map((p) => ({
        id: p.id,
        name: p.name,
        colorHex: p.colorHex,
      }))}
      defaultPaidById={me?.id ?? projectPeople[0]?.id ?? null}
    />
  );
}
