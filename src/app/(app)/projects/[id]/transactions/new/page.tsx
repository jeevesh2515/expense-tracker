import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { people } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SplitForm } from "@/components/SplitForm";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({
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
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-xl font-semibold">New transaction</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Currency: {project.currencyCode} ({project.currencySymbol})
            </p>
          </div>
          <Link
            href={`/projects/${project.id}/transactions`}
            className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
        </CardHeader>
        <CardBody>
          <SplitForm
            projectId={project.id}
            people={projectPeople.map((p) => ({
              id: p.id,
              name: p.name,
              colorHex: p.colorHex,
            }))}
            currencySymbol={project.currencySymbol}
            currencyCode={project.currencyCode}
            defaultPaidById={me?.id ?? projectPeople[0]?.id ?? null}
          />
        </CardBody>
      </Card>
    </div>
  );
}
