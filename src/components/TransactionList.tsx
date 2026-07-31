"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Receipt, ArrowRight, Eye, Pencil, Upload } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatCentsCompact, formatDate } from "@/lib/utils";
import { computeTransactionBalances } from "@/lib/calculations";
import { TransactionFiltersBar, type TransactionFilters } from "@/components/TransactionFilters";

type TransactionData = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  totalAmountCents: number;
  paidById: string;
  occurredAt: Date | number;
};

type SplitData = {
  transactionId: string;
  personId: string;
  owedAmountCents: number;
};

type PaymentData = {
  transactionId: string;
  personId: string;
  amountCents: number;
};

type PersonData = {
  id: string;
  name: string;
  colorHex: string;
};

type Props = {
  projectId: string;
  currencySymbol: string;
  transactions: TransactionData[];
  splits: SplitData[];
  payments: PaymentData[];
  people: PersonData[];
};

// Swipeable transaction row component
function SwipeableTransactionRow({
  projectId,
  currencySymbol,
  transaction: t,
  status,
  payer,
}: {
  projectId: string;
  currencySymbol: string;
  transaction: TransactionData;
  status: "paid" | "partial" | "unpaid";
  payer?: PersonData;
}) {
  const fullyPaid = status === "paid";
  const partiallyPaid = status === "partial";
  const x = useMotionValue(0);
  const actionsOpacity = useTransform(x, [-120, -60, 0], [1, 0.8, 0]);

  return (
    <li className="relative overflow-hidden">
      {/* Hidden action layer behind the row */}
      <div
        className="absolute inset-0 flex items-center justify-end gap-2 px-4 bg-brand-50 dark:bg-brand-900/20"
        style={{ opacity: actionsOpacity as unknown as number }}
      >
        <Link
          href={`/projects/${projectId}/transactions/${t.id}`}
          className="p-2.5 rounded-lg bg-white dark:bg-gray-800 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </Link>
        <Link
          href={`/projects/${projectId}/transactions/${t.id}/edit`}
          className="p-2.5 rounded-lg bg-white dark:bg-gray-800 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Pencil className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </Link>
      </div>

      {/* Swipeable row */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        className="relative bg-white dark:bg-gray-900 touch-pan-y"
      >
        <Link
          href={`/projects/${projectId}/transactions/${t.id}`}
          className="group flex items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 min-h-[64px] hover:bg-brand-50/50 dark:hover:bg-brand-950/30 transition-all duration-200"
        >
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
            {payer && <Avatar name={payer.name} color={payer.colorHex} size="sm" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate text-sm sm:text-base transition-colors">
                  {t.title}
                </span>
                {fullyPaid && <span className="badge badge-green text-[10px] sm:text-xs">Settled</span>}
                {partiallyPaid && <span className="badge badge-amber text-[10px] sm:text-xs">Partial</span>}
                {!fullyPaid && !partiallyPaid && <span className="badge badge-gray text-[10px] sm:text-xs">Unpaid</span>}
                {t.category && (
                  <span className="badge badge-gray text-[10px] sm:text-xs hidden sm:inline-flex">{t.category}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {payer?.name ?? "?"} paid · {formatDate(t.occurredAt)}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {formatCentsCompact(t.totalAmountCents, currencySymbol)}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-brand-500 group-hover:translate-x-1 shrink-0 hidden sm:block transition-all duration-200" />
        </Link>
      </motion.div>
    </li>
  );
}

export function TransactionList({
  projectId,
  currencySymbol,
  transactions: allTransactions,
  splits: allSplits,
  payments: allPayments,
  people,
}: Props) {
  const [filters, setFilters] = useState<TransactionFilters>({
    search: "",
    category: "",
    status: "all",
    dateFrom: "",
    dateTo: "",
  });

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const t of allTransactions) {
      if (t.category) cats.add(t.category);
    }
    return Array.from(cats).sort();
  }, [allTransactions]);

  const splitsByTxn = useMemo(() => {
    const map = new Map<string, SplitData[]>();
    for (const s of allSplits) {
      const arr = map.get(s.transactionId) ?? [];
      arr.push(s);
      map.set(s.transactionId, arr);
    }
    return map;
  }, [allSplits]);

  const paymentsByTxn = useMemo(() => {
    const map = new Map<string, PaymentData[]>();
    for (const p of allPayments) {
      const arr = map.get(p.transactionId) ?? [];
      arr.push(p);
      map.set(p.transactionId, arr);
    }
    return map;
  }, [allPayments]);

  const personById = useMemo(() => {
    return new Map(people.map((p) => [p.id, p]));
  }, [people]);

  const txnStatusMap = useMemo(() => {
    const map = new Map<string, "paid" | "partial" | "unpaid">();
    for (const t of allTransactions) {
      const txnSplits = splitsByTxn.get(t.id) ?? [];
      const txnPayments = paymentsByTxn.get(t.id) ?? [];
      const lines = computeTransactionBalances({
        splits: txnSplits.map((s) => ({ personId: s.personId, owedAmountCents: s.owedAmountCents })),
        payments: txnPayments.map((p) => ({ personId: p.personId, amountCents: p.amountCents })),
      });
      const fullyPaid = lines.length > 0 && lines.every((l) => l.status === "paid");
      const partiallyPaid = !fullyPaid && lines.some((l) => l.status !== "unpaid");
      map.set(t.id, fullyPaid ? "paid" : partiallyPaid ? "partial" : "unpaid");
    }
    return map;
  }, [allTransactions, splitsByTxn, paymentsByTxn]);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((t) => {
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(query);
        const descMatch = t.description?.toLowerCase().includes(query);
        const catMatch = t.category?.toLowerCase().includes(query);
        const payer = personById.get(t.paidById);
        const payerMatch = payer?.name.toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !catMatch && !payerMatch) return false;
      }

      if (filters.category && t.category !== filters.category) return false;

      if (filters.status !== "all") {
        const status = txnStatusMap.get(t.id) ?? "unpaid";
        if (filters.status !== status) return false;
      }

      if (filters.dateFrom) {
        const txnDate = new Date(t.occurredAt);
        const fromDate = new Date(filters.dateFrom);
        if (txnDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const txnDate = new Date(t.occurredAt);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (txnDate > toDate) return false;
      }

      return true;
    });
  }, [allTransactions, filters, txnStatusMap, personById]);

  const filteredTotal = useMemo(() => {
    return filteredTransactions.reduce((s, t) => s + t.totalAmountCents, 0);
  }, [filteredTransactions]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold dark:text-white">Transactions</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {filteredTransactions.length} {filteredTransactions.length === 1 ? "transaction" : "transactions"} ·{" "}
            {currencySymbol}
            {(filteredTotal / 100).toFixed(2)} total
            {filters.search || filters.category || filters.status !== "all" || filters.dateFrom || filters.dateTo
              ? ` (filtered from ${allTransactions.length})`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${projectId}/transactions/batch`}>
            <Button variant="secondary" className="min-h-[44px]">
              <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Batch upload</span><span className="sm:hidden">Batch</span>
            </Button>
          </Link>
          <Link href={`/projects/${projectId}/transactions/new`}>
            <Button className="min-h-[44px]">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New transaction</span><span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>
      </div>

      {allTransactions.length > 0 && (
        <TransactionFiltersBar categories={categories} onChange={setFilters} />
      )}

      {allTransactions.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="mb-2 dark:text-white">No transactions yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Click below to log your first expense.
              </p>
              <Link href={`/projects/${projectId}/transactions/new`}>
                <Button><Plus className="w-4 h-4" /> Add first transaction</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : filteredTransactions.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="mb-2 dark:text-white">No matching transactions</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Try adjusting your filters or search query.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {filteredTransactions.length > 0 && (
            <div className="sm:hidden px-4 pt-3 pb-1">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                ← Swipe left for quick actions
              </p>
            </div>
          )}
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredTransactions.map((t) => {
              const status = txnStatusMap.get(t.id) ?? "unpaid";
              const payer = personById.get(t.paidById);
              return (
                <SwipeableTransactionRow
                  key={t.id}
                  projectId={projectId}
                  currencySymbol={currencySymbol}
                  transaction={t}
                  status={status}
                  payer={payer}
                />
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
