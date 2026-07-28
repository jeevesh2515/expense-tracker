"use client";

import { useState } from "react";
import { Search, Filter, X, Calendar, Tag, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export type TransactionFilters = {
  search: string;
  category: string;
  status: "all" | "paid" | "partial" | "unpaid";
  dateFrom: string;
  dateTo: string;
};

type Props = {
  categories: string[];
  onChange: (filters: TransactionFilters) => void;
};

export function TransactionFiltersBar({ categories, onChange }: Props) {
  const [filters, setFilters] = useState<TransactionFilters>({
    search: "",
    category: "",
    status: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  function update(patch: Partial<TransactionFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    onChange(next);
  }

  const hasFilters = filters.search || filters.category || filters.status !== "all" || filters.dateFrom || filters.dateTo;
  const activeFilterCount = [filters.search, filters.category, filters.status !== "all" ? "s" : "", filters.dateFrom, filters.dateTo].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search bar - always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search transactions…"
          className="input pl-10 pr-10 min-h-[44px]"
        />
        {filters.search && (
          <button
            onClick={() => update({ search: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter toggle + active chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={showAdvanced ? "primary" : "secondary"}
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="min-h-[40px]"
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={cn("w-3 h-3 transition-transform", showAdvanced && "rotate-180")} />
        </Button>

        {/* Active filter chips */}
        {hasFilters && (
          <>
            {filters.category && (
              <button
                onClick={() => update({ category: "" })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-medium hover:bg-brand-200 dark:hover:bg-brand-800/40 transition-colors min-h-[32px]"
              >
                <Tag className="w-3 h-3" />
                {filters.category}
                <X className="w-3 h-3" />
              </button>
            )}
            {filters.status !== "all" && (
              <button
                onClick={() => update({ status: "all" })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-medium hover:bg-brand-200 dark:hover:bg-brand-800/40 transition-colors min-h-[32px]"
              >
                <CheckCircle2 className="w-3 h-3" />
                {filters.status === "paid" ? "Settled" : filters.status === "partial" ? "Partial" : "Unpaid"}
                <X className="w-3 h-3" />
              </button>
            )}
            {filters.dateFrom && (
              <button
                onClick={() => update({ dateFrom: "" })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-medium hover:bg-brand-200 dark:hover:bg-brand-800/40 transition-colors min-h-[32px]"
              >
                <Calendar className="w-3 h-3" />
                From: {filters.dateFrom}
                <X className="w-3 h-3" />
              </button>
            )}
            {filters.dateTo && (
              <button
                onClick={() => update({ dateTo: "" })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-medium hover:bg-brand-200 dark:hover:bg-brand-800/40 transition-colors min-h-[32px]"
              >
                <Calendar className="w-3 h-3" />
                To: {filters.dateTo}
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => {
                const empty: TransactionFilters = { search: "", category: "", status: "all", dateFrom: "", dateTo: "" };
                setFilters(empty);
                onChange(empty);
              }}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline min-h-[32px] flex items-center"
            >
              Clear all
            </button>
          </>
        )}
      </div>

      {/* Advanced filters - collapsible */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          showAdvanced ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="card p-4 space-y-3">
          {/* Category filter */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => update({ category: e.target.value })}
              className="input text-sm min-h-[44px]"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => update({ status: e.target.value as TransactionFilters["status"] })}
              className="input text-sm min-h-[44px]"
            >
              <option value="all">All statuses</option>
              <option value="paid">Settled</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          {/* Date range - horizontal on mobile */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => update({ dateFrom: e.target.value })}
                className="input text-sm min-h-[44px]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => update({ dateTo: e.target.value })}
                className="input text-sm min-h-[44px]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
