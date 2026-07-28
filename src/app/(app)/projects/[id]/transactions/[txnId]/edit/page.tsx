import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { ChevronLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { transactions, splits, people } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { SplitForm } from "@/components/SplitForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit transaction · Splittrack" };

export default async function EditTransactionPage({
  params,
}: {
  params: { id: string; txnId: string };
}) {
  const project = await requireProject(params.id);

  const txn = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, params.txnId), eq(transactions.projectId, project.id)))
    .get();
  if (!txn) notFound();

  const txnSplits = await db
    .select()
    .from(splits)
    .where(eq(splits.transactionId, txn.id))
    .all();

  const projectPeople = await db
    .select()
    .from(people)
    .where(eq(people.projectId, project.id))
    .all();

  // Convert occurredAt timestamp to YYYY-MM-DD for the date input
  const occurredAtDate = new Date(txn.occurredAt);
  const occurredAtStr = occurredAtDate.toISOString().slice(0, 10);

  // Determine the share type from the first split
  const initialShareType = (txnSplits[0]?.shareType ?? "equal") as "equal" | "exact" | "percentage";

  return (
    <div className="max-w-3xl animate-fade-in">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <h2 className="text-xl font-semibold dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                Edit transaction
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Currency: {project.currencyCode} ({project.currencySymbol})
              </p>
            </div>
            <Link
              href={`/projects/${project.id}/transactions/${txn.id}`}
              className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Link>
          </div>
        </CardHeader>
        <CardBody>
          <SplitForm
            projectId={project.id}
            txnId={txn.id}
            people={projectPeople.map((p) => ({
              id: p.id,
              name: p.name,
              colorHex: p.colorHex,
            }))}
            currencySymbol={project.currencySymbol}
            currencyCode={project.currencyCode}
            defaultPaidById={null}
            initialTitle={txn.title}
            initialDescription={txn.description ?? ""}
            initialCategory={txn.category ?? ""}
            initialTotalAmountCents={txn.totalAmountCents}
            initialPaidById={txn.paidById}
            initialOccurredAt={occurredAtStr}
            initialShareType={initialShareType}
            initialSplits={txnSplits.map((s) => ({
              personId: s.personId,
              shareType: s.shareType,
              shareValue: s.shareValue,
              owedAmountCents: s.owedAmountCents,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
