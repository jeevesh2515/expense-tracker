"use client";

"use client";

import { MotionDiv } from "@/components/MotionDiv";
import { formatCentsCompact } from "@/lib/utils";
import { TrendingUp, Receipt, Users, Wallet } from "lucide-react";

type StatsProps = {
  totalProjects: number;
  totalTransactions: number;
  totalPeople: number;
  totalAmountCents: number;
  currencySymbol: string;
};

const statCards = [
  { key: "projects", icon: TrendingUp, label: "Projects", color: "text-brand-600 dark:text-brand-400", bg: "bg-brand-50 dark:bg-brand-900/20" },
  { key: "transactions", icon: Receipt, label: "Transactions", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  { key: "people", icon: Users, label: "People", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
  { key: "total", icon: Wallet, label: "Total Tracked", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20" },
];

export function DashboardStats({ totalProjects, totalTransactions, totalPeople, totalAmountCents, currencySymbol }: StatsProps) {
  const values: Record<string, string> = {
    projects: String(totalProjects),
    transactions: String(totalTransactions),
    people: String(totalPeople),
    total: formatCentsCompact(totalAmountCents, currencySymbol),
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((s, i) => (
        <MotionDiv
          key={s.key}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          className="card p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{values[s.key]}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          </div>
        </MotionDiv>
      ))}
    </div>
  );
}
