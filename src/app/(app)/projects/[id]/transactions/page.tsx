import Link from "next/link";
import { eq, desc, inArray, sum } from "drizzle-orm";
import { Plus, Receipt, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { transactions, splits, payments, people } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import {
  computeTransactionBalances,
} from "@/lib/calculations";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatCentsCompact, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({ params }: { params: { id: string } }) {
  const project = await requireProject(params.id);

  const projectPeople = await db
    .select()
    .from(people)
    .where(eq(people.projectId, project.id))
    .all();
  const projectTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.projectId, project.id))
    .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt))
    .all();

  const transactionIds = projectTransactions.map((t) => t.id);
  const allSplits =
    transactionIds.length === 0
      ? []
      : await db.select().from(splits).where(inArray(splits.transactionId, transactionIds)).all();
  const allPayments =
    transactionIds.length === 0
      ? []
      : await db.select().from(payments).where(inArray(payments.transactionId, transactionIds)).all();

  const splitsByTxn = new Map<string, typeof allSplits>();
  for (const s of allSplits) {
    const arr = splitsByTxn.get(s.transactionId) ?? [];
    arr.push(s);
    splitsByTxn.set(s.transactionId, arr);
  }
  const paymentsByTxn = new Map<string, typeof allPayments>();
  for (const p of allPayments) {
    const arr = paymentsByTxn.get(p.transactionId) ?? [];
    arr.push(p);
    paymentsByTxn.set(p.transactionId, arr);
  }

  const personById = new Map(projectPeople.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Transactions</h2>
          <p className="text-sm text-gray-500">
            {projectTransactions.length} {projectTransactions.length === 1 ? "transaction" : "transactions"} ·{" "}
            {project.currencySymbol}
            {projectTransactions.reduce((s, t) => s + t.totalAmountCents, 0) / 100} total
          </p>
        </div>
        <Link href={`/projects/${project.id}/transactions/new`}>
          <Button>
            <Plus className="w-4 h-4" /> New transaction
          </Button>
        </Link>
      </div>

      {projectTransactions.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="mb-2">No transactions yet</h3>
              <p className="text-gray-500 mb-6">
                Click below to log your first expense.
              </p>
              <Link href={`/projects/${project.id}/transactions/new`}>
                <Button><Plus className="w-4 h-4" /> Add first transaction</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-gray-100">
            {projectTransactions.map((t) => {
              const txnSplits = splitsByTxn.get(t.id) ?? [];
              const txnPayments = paymentsByTxn.get(t.id) ?? [];
              const lines = computeTransactionBalances({
                splits: txnSplits.map((s) => ({ personId: s.personId, owedAmountCents: s.owedAmountCents })),
                payments: txnPayments.map((p) => ({ personId: p.personId, amountCents: p.amountCents })),
              });
              const fullyPaid = lines.length > 0 && lines.every((l) => l.status === "paid");
              const partiallyPaid = !fullyPaid && lines.some((l) => l.status !== "unpaid");
              const payer = personById.get(t.paidById);
              return (
                <li key={t.id} className="hover:bg-gray-50">
                  <Link
                    href={`/projects/${project.id}/transactions/${t.id}`}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {payer && <Avatar name={payer.name} color={payer.colorHex} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 truncate">{t.title}</span>
                          {fullyPaid && <span className="badge badge-green">Settled</span>}
                          {partiallyPaid && <span className="badge badge-amber">Partial</span>}
                          {!fullyPaid && !partiallyPaid && <span className="badge badge-gray">Unpaid</span>}
                          {t.category && (
                            <span className="badge badge-gray">{t.category}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {payer?.name ?? "?"} paid · {formatDate(t.occurredAt)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-gray-900">
                        {formatCentsCompact(t.totalAmountCents, project.currencySymbol)}
                      </div>
                      {lines.length > 0 && (
                        <div className="text-xs text-gray-400">
                          {lines.length} {lines.length === 1 ? "person" : "people"}
                        </div>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
