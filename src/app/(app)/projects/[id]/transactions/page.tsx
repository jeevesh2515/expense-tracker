import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, splits, payments, people } from "@/lib/db/schema";
import { requireProject } from "@/lib/server-utils";
import { TransactionList } from "@/components/TransactionList";

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

  return (
    <TransactionList
      projectId={project.id}
      currencySymbol={project.currencySymbol}
      transactions={projectTransactions}
      splits={allSplits}
      payments={allPayments}
      people={projectPeople.map((p) => ({
        id: p.id,
        name: p.name,
        colorHex: p.colorHex,
      }))}
    />
  );
}
