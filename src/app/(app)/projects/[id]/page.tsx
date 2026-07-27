import Link from "next/link";
import { eq, desc, inArray, and } from "drizzle-orm";
import { Plus, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { people, transactions, splits, payments } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import {
  computeProjectBalances,
  simplifySettlements,
} from "@/lib/calculations";
import { BalanceView } from "@/components/BalanceView";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCentsCompact, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({
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
  const projectTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.projectId, project.id))
    .orderBy(desc(transactions.occurredAt))
    .all();

  const transactionIds = projectTransactions.map((t) => t.id);
  const allSplitsByProject =
    transactionIds.length === 0
      ? []
      : await db
          .select()
          .from(splits)
          .where(inArray(splits.transactionId, transactionIds))
          .all();
  const txPaymentRows =
    transactionIds.length === 0
      ? []
      : await db
          .select()
          .from(payments)
          .where(inArray(payments.transactionId, transactionIds))
          .all();

  const balances = computeProjectBalances({
    people: projectPeople.map((p) => ({ id: p.id, name: p.name })),
    transactions: projectTransactions.map((t) => ({ id: t.id, paidById: t.paidById })),
    splits: allSplitsByProject.map((s) => ({
      transactionId: s.transactionId,
      personId: s.personId,
      owedAmountCents: s.owedAmountCents,
    })),
    payments: txPaymentRows.map((p) => ({
      transactionId: p.transactionId,
      personId: p.personId,
      amountCents: p.amountCents,
    })),
  });

  // Compute settlement simplification against project balances alone.
  const settlements = simplifySettlements(balances.people);

  return (
    <div className="space-y-6">
      {projectPeople.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <h3 className="mb-2">No people yet</h3>
              <p className="text-gray-500 mb-6">
                Add the friends you'll be splitting expenses with.
              </p>
              <Link href={`/projects/${project.id}/people`}>
                <Button><Plus className="w-4 h-4" /> Add people</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : projectTransactions.length === 0 ? (
        <EmptyTransactions
          projectId={project.id}
          peopleCount={projectPeople.length}
        />
      ) : (
        <>
          <BalanceView
            balances={balances.people}
            settlements={settlements}
            symbol={project.currencySymbol}
            code={project.currencyCode}
          />

          <Card>
            <CardHeader>
              <h3 className="font-semibold">Recent transactions</h3>
              <Link href={`/projects/${project.id}/transactions`} className="text-xs text-brand-600 font-medium">
                View all →
              </Link>
            </CardHeader>
            <CardBody className="divide-y divide-gray-100">
              {projectTransactions.slice(0, 6).map((t) => {
                const payer = projectPeople.find((p) => p.id === t.paidById);
                return (
                  <Link
                    key={t.id}
                    href={`/projects/${project.id}/transactions/${t.id}`}
                    className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Receipt className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{t.title}</div>
                        <div className="text-xs text-gray-500">
                          {payer?.name ?? "?"} paid ·{" "}
                          {formatDate(t.occurredAt)}
                          {t.category ? ` · ${t.category}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 ml-3 shrink-0">
                      {formatCentsCompact(t.totalAmountCents, project.currencySymbol)}
                    </div>
                  </Link>
                );
              })}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

function EmptyTransactions({ projectId, peopleCount }: { projectId: string; peopleCount: number }) {
  return (
    <Card>
      <CardBody>
        <div className="text-center py-12">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="mb-2">No transactions yet</h3>
          <p className="text-gray-500 mb-6">
            You've added {peopleCount} {peopleCount === 1 ? "person" : "people"}. Time to log an expense.
          </p>
          <Link href={`/projects/${projectId}/transactions/new`}>
            <Button><Plus className="w-4 h-4" /> Add transaction</Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
