"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, HandCoins } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { formatCentsCompact } from "@/lib/utils";
import { settleUpAction } from "@/lib/actions/payment-actions";

export type SettlementCta = {
  fromId: string;
  fromName: string;
  fromColorHex: string;
  toId: string;
  toName: string;
  toColorHex: string;
  cents: number;
};

/**
 * Stable row identity — used as both React key and the "settled in-session"
 * tracking key. The pair (fromId, toId) is unique per project because the
 * simplification algorithm collapses each unordered pair into at most one
 * settlement.
 */
function rowKey(row: SettlementCta): string {
  return `${row.fromId}|${row.toId}`;
}

export function SettleUpCard({
  projectId,
  settlements,
  currencySymbol,
}: {
  projectId: string;
  settlements: SettlementCta[];
  currencySymbol: string;
}) {
  // Local settled keys so the row disappears immediately on click. The
  // parent's next revalidation will also exclude it, so the local set is
  // a snappy UX shortcut — not a divergent source of truth.
  const [settledKeys, setSettledKeys] = useState<Set<string>>(() => new Set());

  // Garbage-collect settled keys: drop any key that is no longer present
  // in the parent's settlement list (e.g. parent revalidated after another
  // tab settled the same pair). Returning prev unchanged when no work is
  // needed short-circuits the re-render.
  useEffect(() => {
    const live = new Set(settlements.map(rowKey));
    setSettledKeys((prev) => {
      const next = new Set([...prev].filter((k) => live.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [settlements]);

  // SettleUpCard only renders when the parent has at least one settlement.
  // After the user clears all visible rows in-session, return null so we
  // don't duplicate BalanceView's "Everyone is settled up!" empty state.
  const visibleRows = settlements.filter((r) => !settledKeys.has(rowKey(r)));
  if (visibleRows.length === 0) return null;

  async function settle(row: SettlementCta) {
    const key = rowKey(row);
    // Optimistic: drop the row from view immediately. The async settleUpAction
    // call below does not issue any transitional state update, so we run it
    // plainly (no useTransition wrapper) — rollback state updates on error
    // want to be URGENT so the row reappears without delay.
    setSettledKeys((prev) => new Set(prev).add(key));

    // Single rollback used by both error paths (catch + modeled error).
    const rollback = () => {
      setSettledKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };

    // SettleUpAction returns a structured { error, allocations } envelope
    // for modeled failure paths (validation, no underlying debt, totals
    // mismatch), but it can also throw for unmodeled paths (Drizzle
    // transient errors, Turso network timeouts, requireProject auth throw).
    // Wrap in try/catch so a rejection rolls back the optimistic hide and
    // surfaces a generic toast instead of leaving the row stuck hidden.
    const res = await settleUpAction(
      projectId,
      row.fromId,
      row.toId,
      row.cents,
    ).catch(() => {
      rollback();
      toast.error("Couldn\u2019t record settlement. Please try again.");
      return null;
    });
    if (!res) return; // catch already toasted + rolled back

    if (res.error) {
      rollback();
      toast.error(res.error);
      return;
    }
    const allocation = res.allocations;
    const description =
      allocation.length === 1
        ? `Cleared ${formatCentsCompact(allocation[0]!.amountCents, currencySymbol)} on \u201C${allocation[0]!.transactionTitle}\u201D`
        : `Cleared across ${allocation.length} transactions`;
    toast.success(`${row.fromName} \u2192 ${row.toName} settled`, {
      description,
    });
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold dark:text-white inline-flex items-center gap-2">
          <HandCoins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          Settle up
        </h3>
        <span className="text-xs text-gray-400">
          {visibleRows.length} suggested
          {visibleRows.length === 3 ? "+" : ""} transfer
          {visibleRows.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardBody className="space-y-2">
        {visibleRows.map((row) => {
          const key = rowKey(row);
          return (
            <div
              key={key}
              className="flex items-center gap-3 p-3.5 rounded-xl border bg-gradient-to-r from-amber-50/90 to-orange-50/70 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-200/80 dark:border-amber-800/60 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <Avatar name={row.fromName} color={row.fromColorHex} size="sm" className="group-hover:scale-105 transition-transform" />
              <span className="font-semibold text-gray-900 dark:text-white truncate min-w-0 flex-1">
                {row.fromName}
              </span>
              <ArrowRight className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:translate-x-1 shrink-0 transition-transform duration-200" />
              <Avatar name={row.toName} color={row.toColorHex} size="sm" className="group-hover:scale-105 transition-transform" />
              <span className="font-semibold text-gray-900 dark:text-white truncate min-w-0 flex-1">
                {row.toName}
              </span>
              <span className="ml-auto font-bold text-amber-700 dark:text-amber-300 tabular-nums shrink-0 text-sm sm:text-base">
                {formatCentsCompact(row.cents, currencySymbol)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => settle(row)}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all text-xs font-semibold px-3 py-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Record payment
              </Button>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
