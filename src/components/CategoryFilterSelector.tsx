"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CATEGORY_FILTER_UNTAGGED,
  type CategoryFilter,
} from "@/lib/db/schema";
import { setCategoryFilterAction } from "@/lib/actions/project-actions";

/**
 * Server-prepared option list for the category filter selector.
 *
 * `null` value entries are the sentinel for "show me transactions missing a
 * category"; the label is what the user actually sees ("Untagged"). The page
 * computes the order server-side (spend-descending) so the most-relevant
 * options land in the leftmost/visible slots before the user needs to wrap.
 */
export type CategoryFilterOption = {
  /** Wire/storage value: `null` for the "All" option, otherwise a category
   *  string the user has actually used (or the `__untagged__` sentinel). */
  value: CategoryFilter;
  /** Display label. */
  label: string;
  /** Display subtitle showing the total in the active range (for context). */
  totalLabel?: string;
};

export function CategoryFilterSelector({
  projectId,
  currentFilter,
  options,
}: {
  projectId: string;
  currentFilter: CategoryFilter;
  options: CategoryFilterOption[];
}) {
  const [isPending, startTransition] = useTransition();

  function select(next: CategoryFilter) {
    if (next === currentFilter) return;
    startTransition(async () => {
      try {
        const res = await setCategoryFilterAction(projectId, next);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        // No success toast — chart + donut re-render is the confirmation.
      } catch {
        toast.error("Couldn\u2019t save filter. Please try again.");
      }
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Category filter"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Category
      </span>
      <div
        className={cn(
          "inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900",
          isPending && "opacity-60",
        )}
      >
        {options.map((opt) => {
          const isActive = opt.value === currentFilter;
          return (
            <button
              key={opt.value ?? "__all__"}
              type="button"
              onClick={() => select(opt.value)}
              disabled={isPending || isActive}
              aria-pressed={isActive}
              title={
                opt.value === null
                  ? "Show all transactions"
                  : opt.value === CATEGORY_FILTER_UNTAGGED
                    ? "Show only transactions with no category"
                    : `Show only \u201C${opt.label}\u201D transactions`
              }
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150",
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white",
              )}
            >
              {opt.totalLabel ? (
                <span className="inline-flex items-baseline gap-1.5">
                  <span>{opt.label}</span>
                  <span
                    className={cn(
                      "text-[10px] font-normal tabular-nums",
                      isActive
                        ? "text-white/70"
                        : "text-gray-400 dark:text-gray-500",
                    )}
                  >
                    {opt.totalLabel}
                  </span>
                </span>
              ) : (
                opt.label
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
