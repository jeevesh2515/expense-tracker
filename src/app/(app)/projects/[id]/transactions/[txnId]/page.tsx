import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { ChevronLeft, Receipt, Calendar, Tag, User, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { transactions, splits, payments, people } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import { computeTransactionBalances } from "@/lib/calculations";
import { Card, CardBody } from "@/components/ui/Card";
import { formatCentsCompact, formatDate } from "@/lib/utils";
import { PersonPaymentCard } from "@/components/PersonPaymentCard";
import { DeleteTransactionButton } from "@/components/DeleteTransactionButton";
import { ReceiptImageThumbnail } from "@/components/ReceiptImageThumbnail";
import {
  deleteTransactionAction,
} from "@/lib/actions/transaction-actions";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({
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
  const txnPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.transactionId, txn.id))
    .orderBy(payments.paidAt)
    .all();

  const projectPeople = await db
    .select()
    .from(people)
    .where(eq(people.projectId, project.id))
    .all();
  const personById = new Map(projectPeople.map((p) => [p.id, p]));
  const payer = personById.get(txn.paidById);

  const lines = computeTransactionBalances({
    splits: txnSplits.map((s) => ({ personId: s.personId, owedAmountCents: s.owedAmountCents })),
    payments: txnPayments.map((p) => ({ personId: p.personId, amountCents: p.amountCents })),
  });

  const paymentsByPerson = new Map<string, typeof txnPayments>();
  for (const p of txnPayments) {
    const arr = paymentsByPerson.get(p.personId) ?? [];
    arr.push(p);
    paymentsByPerson.set(p.personId, arr);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/projects/${project.id}/transactions`}
          className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" /> All transactions
        </Link>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{txn.title}</h2>
              <div className="text-sm text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5" />
                  {project.currencySymbol}
                  {formatCentsCompact(txn.totalAmountCents, "")}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(txn.occurredAt)}
                </span>
                {txn.category && (
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    {txn.category}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Paid by {payer?.name ?? "?"}
                </span>
              </div>
              {txn.description && (
                <p className="text-sm text-gray-600 mt-3 max-w-2xl">{txn.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${project.id}/transactions/${txn.id}/edit`}
                className="btn btn-secondary btn-sm"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Link>
              <DeleteTransactionButton
                projectId={project.id}
                txnId={txn.id}
                txnTitle={txn.title}
                onDelete={async () => {
                  "use server";
                  await deleteTransactionAction(project.id, txn.id);
                }}
              />
            </div>
          </div>

          {/* Receipt Image Thumbnail */}
          {txn.receiptImage && (
            <ReceiptImageThumbnail
              receiptImage={txn.receiptImage}
              title={txn.title}
            />
          )}
        </CardBody>
      </Card>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold">Per-person breakdown</h3>
          <span className="text-xs text-gray-500">{lines.length} {lines.length === 1 ? "person" : "people"}</span>
        </div>
        <div className="divide-y divide-gray-100">
          {lines.length === 0 && (
            <div className="p-5 text-sm text-gray-500">
              No participants on this transaction.
            </div>
          )}
          {lines.map((l) => {
            const person = personById.get(l.personId);
            const personPayments = paymentsByPerson.get(l.personId) ?? [];
            return (
              <PersonPaymentCard
                key={l.personId}
                projectId={project.id}
                txnId={txn.id}
                personId={l.personId}
                personName={person?.name ?? "?"}
                personColorHex={person?.colorHex ?? "#6366f1"}
                owed={l.owed}
                paid={l.paid}
                remaining={l.remaining}
                status={l.status}
                payments={personPayments}
                currencySymbol={project.currencySymbol}
                currencyCode={project.currencyCode}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
