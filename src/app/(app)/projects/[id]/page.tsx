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
import { ProjectCharts, type CategoryPoint, type PersonNet, type SpendingPoint } from "@/components/ProjectCharts";
import { ProjectSankey, type SankeyData, type SankeyDataLink, type SankeyDataNode } from "@/components/ProjectSankey";
import { SettleUpCard, type SettlementCta } from "@/components/SettleUpCard";
import { SpendingRangeSelector } from "@/components/SpendingRangeSelector";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { colorForString, formatCentsCompact, formatDate } from "@/lib/utils";

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

  // Top 1-3 highest-priority settlements for the "Settle up" CTA card.
  // The simplifySettlements result is already sorted descending by cents,
  // so a slice is both the priority order and the cardinality cap.
  const personById = new Map(projectPeople.map((p) => [p.id, p]));
  const topSettlements: SettlementCta[] = settlements.slice(0, 3).map((s) => {
    const fromRecord = personById.get(s.fromId);
    const toRecord = personById.get(s.toId);
    return {
      fromId: s.fromId,
      fromName: s.fromName,
      fromColorHex: fromRecord?.colorHex ?? colorForString(s.fromName),
      toId: s.toId,
      toName: s.toName,
      toColorHex: toRecord?.colorHex ?? colorForString(s.toName),
      cents: s.cents,
    };
  });

  // -----------------------------------------------------------------------
  // Server-side aggregations for the chart component. Done here (not in the
  // client component) so we serialize only compact summaries, not the full
  // transaction list.
  //
  // Bucket config follows the per-project spending range the user picked in
  // the SpendingRangeSelector (persisted in `projects.spending_range`). The
  // selection only pivots the spending-over-time trend chart; the category
  // donut, paid-vs-consumed bars, Sankey, SettleUpCard and BalanceView all
  // continue to span the full project timeline.
  // -----------------------------------------------------------------------
  const range = project.spendingRange;
  const now = new Date();

  // Defaults match the legacy 12-week (~84d) chart window — overridden below
  // per range. `daysPerBucket` controls the granularity (1 = daily, 7 = weekly,
  // 30 ≈ monthly for very long projects).
  let bucketCount = 13;
  let daysPerBucket = 7;
  const start = new Date(now);

  if (range === "7d") {
    bucketCount = 7;
    daysPerBucket = 1;
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    bucketCount = 30;
    daysPerBucket = 1;
    start.setDate(start.getDate() - 29);
  } else if (range === "90d") {
    bucketCount = 13;
    daysPerBucket = 7;
    start.setDate(start.getDate() - 12 * 7);
    // Floor `start` to the most recent Sunday so weekly buckets align on the
    // same boundary across renders, giving a stable x-axis regardless of
    // when the page is re-validated.
    const startDow = start.getDay(); // 0 = Sunday
    if (startDow !== 0) start.setDate(start.getDate() - startDow);
  } else {
    // "all" — weekly (≤6 months) or monthly (>6 months) buckets from the
    // project's earliest transaction to today. The page query orders rows
    // desc by `occurredAt` so the last array entry is the earliest.
    if (projectTransactions.length > 0) {
      // Mirror the bucket-fill loop's timestamp parse so we use the same
      // robust `instanceof Date ? getTime() : Number()` idiom instead of
      // the locale-fragile `Date.parse(String(...))`.
      const firstTxn = projectTransactions[projectTransactions.length - 1]!;
      const firstTxnMs =
        firstTxn.occurredAt instanceof Date
          ? firstTxn.occurredAt.getTime()
          : Number(firstTxn.occurredAt);
      const totalDays = Math.max(
        1,
        Math.floor((now.getTime() - firstTxnMs) / 86_400_000),
      );
      daysPerBucket = totalDays > 180 ? 30 : 7;
      bucketCount = Math.max(1, Math.ceil(totalDays / daysPerBucket));
      start.setTime(firstTxnMs);
    } else {
      bucketCount = 1;
      daysPerBucket = 7;
    }
  }

  // Build the bucket boundaries as numeric epoch-ms values so the comparison
  // below is unambiguous and timezone-independent. Bucket keys are still
  // produced as YYYY-MM-DD for human-readable x-axis labels.
  const spendingBucketMs: Array<{ key: string; startMs: number }> = [];
  for (let i = 0; i < bucketCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * daysPerBucket);
    spendingBucketMs.push({
      key: d.toISOString().slice(0, 10),
      startMs: d.getTime(),
    });
  }

  const spendingBuckets = new Map<string, number>(
    spendingBucketMs.map((b) => [b.key, 0]),
  );
  for (const t of projectTransactions) {
    const ts =
      t.occurredAt instanceof Date ? t.occurredAt.getTime() : Number(t.occurredAt);
    if (!Number.isFinite(ts)) continue;
    // Bucket the transaction into the most recent weekly bucket whose start
    // is ≤ ts. Reverse iteration lets us stop early on match.
    for (let i = spendingBucketMs.length - 1; i >= 0; i--) {
      const bucket = spendingBucketMs[i]!;
      if (ts >= bucket.startMs) {
        spendingBuckets.set(
          bucket.key,
          (spendingBuckets.get(bucket.key) ?? 0) + t.totalAmountCents,
        );
        break;
      }
    }
  }
  const spending: SpendingPoint[] = Array.from(spendingBuckets, ([bucket, amount]) => ({
    bucket,
    amount,
  }));

  // Categories: include untagged spend as an explicit "Untagged" slice so
  // the donut is consistent with the AreaChart and the Paid-vs-Consumed
  // bar (which count 100% of spend). Without this, untagged txns would
  // silently disappear from the donut view.
  let untaggedCents = 0;
  const categoryMap = new Map<string, number>();
  for (const t of projectTransactions) {
    const name = (t.category ?? "").trim();
    if (!name) {
      untaggedCents += t.totalAmountCents;
      continue;
    }
    categoryMap.set(name, (categoryMap.get(name) ?? 0) + t.totalAmountCents);
  }
  if (untaggedCents > 0) {
    categoryMap.set("Untagged", untaggedCents);
  }
  // Stamp the synthesized "missing data" row with `untagged: true` so the
  // chart can paint it distinctly even if a user happened to name a real
  // category "Untagged". This avoids a magic-string comparison.
  const categories: CategoryPoint[] = Array.from(
    categoryMap,
    ([name, cents]) => {
      const isUntagged = untaggedCents > 0 && name === "Untagged";
      return isUntagged
        ? { name, cents, untagged: true }
        : { name, cents };
    },
  ).sort((a, b) => b.cents - a.cents);

  const personByIdForCharts = new Map(projectPeople.map((p) => [p.id, p]));
  const paidByPersonAt = projectTransactions.reduce<Map<string, number>>(
    (acc, t) => acc.set(t.paidById, (acc.get(t.paidById) ?? 0) + t.totalAmountCents),
    new Map(),
  );
  const consumedByPerson = allSplitsByProject.reduce<Map<string, number>>(
    (acc, s) => acc.set(s.personId, (acc.get(s.personId) ?? 0) + s.owedAmountCents),
    new Map(),
  );
  const peopleForBars: PersonNet[] = balances.people
    .map((b) => {
      const record = personByIdForCharts.get(b.personId);
      return {
        id: b.personId,
        name: b.name,
        colorHex: record?.colorHex ?? "#6366f1",
        paid: paidByPersonAt.get(b.personId) ?? 0,
        consumed: consumedByPerson.get(b.personId) ?? 0,
        net: b.netCents,
      };
    })
    .sort((a, b) => b.net - a.net);

  // -----------------------------------------------------------------------
  // Sankey: payer → transaction → consumer flow. Drawn at transaction-level
  // granularity so the user can read "who paid for what". Top 8 transactions
  // get their own middle lane; remaining ones collapse into "T_other" so the
  // diagram stays readable regardless of scale.
  // -----------------------------------------------------------------------
  const SANKEY_TOP_N = 8;
  const sortedTxnsDesc = [...projectTransactions].sort(
    (a, b) => b.totalAmountCents - a.totalAmountCents,
  );
  const topTxnIds = new Set(
    sortedTxnsDesc.slice(0, SANKEY_TOP_N).map((t) => t.id),
  );
  const txnById = new Map(projectTransactions.map((t) => [t.id, t]));

  // bucketId contract: "T_<txnId>" for top-8 txns, "T_other" for the rest.
  const bucketIdFor = (txnId: string): string =>
    topTxnIds.has(txnId) ? `T_${txnId}` : "T_other";

  // Pre-allocate consumer-cent maps per bucket (skip the runtime null check on
  // every split).
  const bucketToConsumerCents = new Map<string, Map<string, number>>();
  for (const t of projectTransactions) {
    bucketToConsumerCents.set(bucketIdFor(t.id), new Map());
  }
  for (const s of allSplitsByProject) {
    if (s.owedAmountCents <= 0) continue;
    const t = txnById.get(s.transactionId);
    if (!t) continue;
    const bucketMap = bucketToConsumerCents.get(bucketIdFor(t.id));
    if (!bucketMap) continue;
    bucketMap.set(
      s.personId,
      (bucketMap.get(s.personId) ?? 0) + s.owedAmountCents,
    );
  }

  // Materialize nodes + links for the client component.
  const sankeyNodesById = new Map<string, SankeyDataNode>();
  const ensureNode = (
    id: string,
    name: string,
    type: SankeyDataNode["type"],
    colorHex: string,
  ): void => {
    if (!sankeyNodesById.has(id)) {
      sankeyNodesById.set(id, { id, name, type, colorHex });
    }
  };
  const sankeyLinksByKey = new Map<string, SankeyDataLink>();
  const ensureLink = (key: string, link: SankeyDataLink): void => {
    const existing = sankeyLinksByKey.get(key);
    if (existing) {
      existing.value += link.value;
      return;
    }
    sankeyLinksByKey.set(key, { ...link });
  };

  // Payer + outbound (payer → bucket) links.
  for (const t of projectTransactions) {
    const bucketId = bucketIdFor(t.id);
    const payerRecord = personByIdForCharts.get(t.paidById);
    if (!payerRecord) continue;
    const payerColor = payerRecord.colorHex || colorForString(payerRecord.name);
    ensureNode(`L_${t.paidById}`, payerRecord.name, "payer", payerColor);
    ensureNode(
      bucketId,
      topTxnIds.has(t.id) ? t.title : "Other transactions",
      "txn",
      payerColor,
    );
    ensureLink(`L_${t.paidById}|${bucketId}`, {
      source: `L_${t.paidById}`,
      target: bucketId,
      value: t.totalAmountCents,
    });
  }

  // Consumer + outbound (bucket → consumer) links.
  for (const [bucketId, consumerCents] of bucketToConsumerCents.entries()) {
    for (const [consumerId, cents] of consumerCents.entries()) {
      const consumer = personByIdForCharts.get(consumerId);
      if (!consumer) continue;
      const consumerColor =
        consumer.colorHex || colorForString(consumer.name);
      ensureNode(`R_${consumerId}`, consumer.name, "consumer", consumerColor);
      ensureLink(`${bucketId}|R_${consumerId}`, {
        source: bucketId,
        target: `R_${consumerId}`,
        value: cents,
      });
    }
  }

  const sankeyData: SankeyData = {
    nodes: Array.from(sankeyNodesById.values()),
    links: Array.from(sankeyLinksByKey.values()),
  };

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
          <SpendingRangeSelector
            projectId={project.id}
            currentRange={project.spendingRange}
          />

          <ProjectCharts
            spending={spending}
            categories={categories}
            people={peopleForBars}
            currencySymbol={project.currencySymbol}
          />

          {sankeyData.links.length > 0 && (
            <ProjectSankey
              data={sankeyData}
              currencySymbol={project.currencySymbol}
            />
          )}

          {topSettlements.length > 0 && (
            <SettleUpCard
              projectId={project.id}
              settlements={topSettlements}
              currencySymbol={project.currencySymbol}
            />
          )}

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
