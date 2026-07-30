"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AVATAR_PALETTE, formatCentsCompact } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Server-prepared data shapes                                                 */
/* -------------------------------------------------------------------------- */

export type SpendingPoint = {
  /** YYYY-MM-DD of the start of the (weekly) bucket. */
  bucket: string;
  /** Total cents spent in that bucket. */
  amount: number;
};

export type CategoryPoint = {
  name: string;
  cents: number;
  /**
   * Set by the server for the synthesized "Untagged" row (transactions
   * missing a category). Lets the chart distinguish missing-data from a
   * user-defined category that happens to be called "Untagged".
   */
  untagged?: boolean;
};

export type PersonNet = {
  id: string;
  name: string;
  /** Hex color from the avatar palette; used for the donut wedge and bar fills. */
  colorHex: string;
  /** Sum of totalAmountCents of transactions this person paid. */
  paid: number;
  /** Sum of owedAmountCents across all splits on this person. */
  consumed: number;
  /** Net of inflow minus outflow (signed). */
  net: number;
};

type Props = {
  spending: SpendingPoint[];
  categories: CategoryPoint[];
  people: PersonNet[];
  currencySymbol: string;
  /** Optional override of the area-chart brand color; class hook left for future theming. */
  className?: string;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Color for a category donut wedge, cycling through the avatar palette. */
function categoryColor(index: number, total: number): string {
  // Deterministic: spread distinct categories across the palette so neighbors differ.
  // For small sets this avoids adjacent-wedge color collisions.
  const stride = Math.max(1, Math.floor(AVATAR_PALETTE.length / Math.max(1, total)));
  return AVATAR_PALETTE[(index * stride) % AVATAR_PALETTE.length];
}

/** Special muted neutral used for the Untagged wedge (server-stamped via the
 *  data flag, not a magic name match) so users can tell at a glance that this
 *  slice represents missing data, not a real category. */
const UNTAGGED_FILL = "rgb(var(--muted))";

/** Returns the wedge fill for a category; uses the typed `untagged` flag. */
function fillForCategory(
  c: { untagged?: boolean },
  index: number,
  total: number,
): string {
  return c.untagged ? UNTAGGED_FILL : categoryColor(index, total);
}

/** Format an ISO date string into a short axis label like "Mar 4". */
const SHORT_DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
function formatBucketLabel(bucket: string): string {
  const d = new Date(`${bucket}T00:00:00`);
  return Number.isNaN(d.getTime()) ? bucket : SHORT_DATE_FMT.format(d);
}

/* -------------------------------------------------------------------------- */
/* Reusable tooltip                                                            */
/* -------------------------------------------------------------------------- */

type TooltipPayload = {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; dataKey?: string; payload?: Record<string, unknown> }>;
  label?: string;
  symbol?: string;
};
function ChartTooltip({ active, payload, label, symbol }: TooltipPayload) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      {label && (
        <div className="mb-1 text-xs font-semibold text-gray-900 dark:text-white">{label}</div>
      )}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: entry.color ?? "currentColor" }}
              aria-hidden
            />
            <span className="text-gray-700 dark:text-gray-300">
              {entry.name}: <span className="font-mono font-semibold text-gray-900 dark:text-white">{formatCentsCompact(Number(entry.value), symbol ?? "₹")}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center dark:border-gray-700 dark:bg-gray-800/40">
      <div className="text-2xl">📊</div>
      <p className="max-w-xs text-sm text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function ProjectCharts({
  spending,
  categories,
  people,
  currencySymbol,
  className,
}: Props) {
  // Pre-format x-axis labels once so we don't churn the DOM on every render.
  const spendingPlot = useMemo(
    () =>
      spending.map((p) => ({
        ...p,
        label: formatBucketLabel(p.bucket),
      })),
    [spending],
  );

  // Computed totals are derived once so render-time math is cheap.
  const totalSpent = useMemo(
    () => spending.reduce((s, p) => s + p.amount, 0),
    [spending],
  );

  const categoriesTotal = useMemo(
    () => categories.reduce((s, c) => s + c.cents, 0),
    [categories],
  );

  return (
    <div className={["grid grid-cols-1 gap-4 lg:grid-cols-3", className].filter(Boolean).join(" ")}>
      {/* Spending over time — full width on lg */}
      <Card className="lg:col-span-3 overflow-hidden">
        <CardHeader>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Spending over time</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Weekly aggregation across the project timeline
            </p>
          </div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Total: {formatCentsCompact(totalSpent, currencySymbol)}
          </span>
        </CardHeader>
        <CardBody className="h-[260px] px-2 pt-2">
          {spendingPlot.length === 0 || totalSpent === 0 ? (
            <ChartEmpty message="Add a transaction or two and these charts will fill in automatically." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={spendingPlot}
                margin={{ top: 12, right: 16, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradientBrandFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgb(var(--border))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="rgb(var(--muted))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke="rgb(var(--muted))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v: number) => formatCentsCompact(v, currencySymbol)}
                />
                <Tooltip
                  cursor={{ stroke: "rgb(var(--accent))", strokeOpacity: 0.2 }}
                  content={<ChartTooltip symbol={currencySymbol} />}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="Spending"
                  stroke="rgb(var(--accent))"
                  strokeWidth={2.5}
                  fill="url(#gradientBrandFill)"
                  isAnimationActive
                  animationDuration={600}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "white" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      {/* Category breakdown — donut, left half on lg */}
      <Card className="lg:col-span-1 overflow-hidden">
        <CardHeader>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Category breakdown</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Where the money goes</p>
          </div>
        </CardHeader>
        <CardBody className="h-[300px] px-2 pt-2">
          {categories.length === 0 ||
          categoriesTotal === 0 ||
          // If the donut's only slice is the synthesized Untagged row, the
          // single muted wedge reads as broken UX. Show a CTA instead so the
          // user can fix it by tagging transactions.
          (categories.length === 1 && categories[0]?.untagged) ? (
            <ChartEmpty message="All your transactions are missing categories. Edit one to add Food, Travel, etc. — this chart fills in as soon as you do." />
          ) : (
            <div className="flex h-full items-center gap-3">
              <div
                className="relative grid h-full"
                style={{ width: "60%" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="cents"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={2}
                      stroke="rgb(var(--bg))"
                      strokeWidth={2}
                      isAnimationActive
                      animationDuration={500}
                    >
                      {categories.map((c, i) => (
                        <Cell
                          key={c.name}
                          fill={fillForCategory(c, i, categories.length)}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<ChartTooltip symbol={currencySymbol} />}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label overlay, sits on top of the donut hole */}
                <div
                  className="pointer-events-none flex flex-col items-center justify-center px-2 text-center"
                  style={{ gridArea: "1 / 1" }}
                >
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Total
                  </div>
                  <div className="whitespace-nowrap font-mono text-sm font-bold text-gray-900 dark:text-white sm:text-base">
                    {formatCentsCompact(categoriesTotal, currencySymbol)}
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-auto pr-2">
                {categories.map((c, i) => {
                  const pct =
                    categoriesTotal > 0
                      ? Math.round((c.cents / categoriesTotal) * 100)
                      : 0;
                  return (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: fillForCategory(c, i, categories.length) }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                        {c.name}
                      </span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-white">
                        {formatCentsCompact(c.cents, currencySymbol)}
                      </span>
                      <span className="w-10 text-right text-gray-500 dark:text-gray-400">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Paid vs Consumed — grouped bar, right half on lg */}
      <Card className="lg:col-span-2 overflow-hidden">
        <CardHeader>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Paid vs consumed</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              How much each person paid vs. their share, sorted by net
            </p>
          </div>
        </CardHeader>
        <CardBody className="h-[300px] px-2 pt-2">
          {people.length === 0 ? (
            <ChartEmpty message="Add people and at least one transaction to see who paid what." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={people}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 24, bottom: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid
                  stroke="rgb(var(--border))"
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  stroke="rgb(var(--muted))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatCentsCompact(v, currencySymbol)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="rgb(var(--muted))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  cursor={{ fill: "rgb(var(--border))", fillOpacity: 0.3 }}
                  content={<ChartTooltip symbol={currencySymbol} />}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                />
                <Bar
                  dataKey="paid"
                  name="Paid"
                  fill="rgb(var(--accent))"
                  radius={[4, 4, 4, 4]}
                  isAnimationActive
                  animationDuration={500}
                />
                <Bar
                  dataKey="consumed"
                  name="Consumed"
                  fill="rgb(var(--muted))"
                  radius={[4, 4, 4, 4]}
                  isAnimationActive
                  animationDuration={500}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
