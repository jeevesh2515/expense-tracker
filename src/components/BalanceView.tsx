import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { formatCents, formatCentsCompact, colorForString } from "@/lib/utils";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { PairBalance, ProjectPersonBalance } from "@/lib/calculations";

export function BalanceView({
  balances,
  settlements,
  symbol,
  code,
}: {
  balances: ProjectPersonBalance[];
  settlements: { fromId: string; fromName: string; toId: string; toName: string; cents: number }[];
  symbol: string;
  code: string;
}) {
  const sorted = [...balances].sort((a, b) => b.netCents - a.netCents);
  const totalUnsettled = settlements.reduce((s, x) => s + x.cents, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <h3 className="font-semibold dark:text-white">Balances</h3>
          <span className="text-xs text-gray-400">{code}</span>
        </CardHeader>
        <CardBody className="space-y-2">
          {sorted.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Add people and transactions to see balances.</p>
          )}
          {sorted.map((p) => (
            <div
              key={p.personId}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={p.name} color={colorForString(p.name)} size="sm" />
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.name}</span>
              </div>
              <div className="text-right">
                <div
                  className={
                    "text-sm font-semibold " +
                    (p.netCents > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : p.netCents < 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-gray-500 dark:text-gray-400")
                  }
                >
                  {p.netCents === 0
                    ? "Settled"
                    : (p.netCents > 0 ? "+" : "−") + formatCentsCompact(Math.abs(p.netCents), symbol)}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500">
                  {p.netCents > 0
                    ? "is owed"
                    : p.netCents < 0
                    ? "owes"
                    : ""}
                </div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold dark:text-white">Suggested settlements</h3>
          {totalUnsettled > 0 && (
            <span className="text-xs text-gray-400">
              ≈ {formatCentsCompact(totalUnsettled, symbol)} in transit
            </span>
          )}
        </CardHeader>
        <CardBody>
          {settlements.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Everyone is settled up!</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {settlements.map((s, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{s.fromName}</span>
                  <ArrowRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium text-gray-900 dark:text-white">{s.toName}</span>
                  <span className="ml-auto font-semibold text-amber-700 dark:text-amber-400">
                    {formatCentsCompact(s.cents, symbol)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
