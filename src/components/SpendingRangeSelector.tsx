"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SPENDING_RANGES,
  type SpendingRange,
} from "@/lib/db/schema";
import { setSpendingRangeAction } from "@/lib/actions/project-actions";

const RANGE_LABELS: Record<SpendingRange, string> = {
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  all: "All-time",
};

export function SpendingRangeSelector({
  projectId,
  currentRange,
}: {
  projectId: string;
  currentRange: SpendingRange;
}) {
  const [isPending, startTransition] = useTransition();

  function select(next: SpendingRange) {
    if (next === currentRange) return;
    startTransition(async () => {
      try {
        const res = await setSpendingRangeAction(projectId, next);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        // No success toast — the chart re-rendering is the confirmation.
      } catch {
        // Unmodeled throw (network / DB). Server action would have been
        // caught by Next.js, but a raw rejection here is rare; toast it.
        toast.error("Couldn\u2019t save range. Please try again.");
      }
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Spending range"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Range
      </span>
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900",
          isPending && "opacity-60",
        )}
      >
        {SPENDING_RANGES.map((r) => {
          const isActive = r === currentRange;
          return (
            <button
              key={r}
              type="button"
              onClick={() => select(r)}
              disabled={isPending || isActive}
              aria-pressed={isActive}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150",
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
