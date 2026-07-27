import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard shadcn-style className helper: combine Tailwind classes safely.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Currency = { code: string; symbol: string };

/**
 * The app is locked to a single currency: Indian Rupee (₹).
 * Kept as a single constant so the symbol stays consistent everywhere
 * (UI, Excel export, CSV, formula strings).
 */
export const DEFAULT_CURRENCY: Currency = { code: "INR", symbol: "₹" };

/**
 * Convert a display amount (e.g. "12.34") to integer cents, rounding half-up.
 * Throws on invalid input so callers must validate before invoking.
 */
export function parseAmountToCents(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("Invalid amount");
    return Math.round(input * 100);
  }
  const trimmed = input.trim();
  if (trimmed === "") throw new Error("Invalid amount");
  // Only allow digits with at most one decimal point.
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) throw new Error("Invalid amount");
  const [whole, frac = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return cents;
}

/**
 * Format integer cents → display string for the currency.
 * Default: en-US style (12,345.67).
 */
export function formatCents(
  cents: number,
  currency: Currency = DEFAULT_CURRENCY,
  options: { withSymbol?: boolean } = {},
): string {
  const { withSymbol = true } = options;
  const safe = Math.round(cents);
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  const wholeWithSeparators = whole.toLocaleString("en-US");
  const body = `${wholeWithSeparators}.${frac}`;
  const display = withSymbol ? `${currency.symbol}${body}` : body;
  return negative ? `-${withSymbol ? currency.symbol : ""}${wholeWithSeparators}.${frac}` : display;
}

/**
 * Format USD-like numbers without forcing a trailing .00 (used in table cells).
 */
export function formatCentsCompact(cents: number, symbol = DEFAULT_CURRENCY.symbol): string {
  const safe = Math.round(cents);
  const whole = Math.floor(Math.abs(safe) / 100);
  const frac = Math.abs(safe) % 100;
  const negative = safe < 0;
  const body = frac === 0 ? whole.toString() : `${whole}.${frac.toString().padStart(2, "0")}`;
  return `${negative ? "-" : ""}${symbol}${body}`;
}

export function formatDate(date: Date | number, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

export function formatTime(date: Date | number): string {
  const d = typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(d);
}

/** Pick an HSL-based avatar color from a string for consistent visual identity. */
export function colorForString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 70%, 55%)`;
}

export const AVATAR_PALETTE = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4",
  "#f43f5e", "#8b5cf6", "#14b8a6", "#eab308", "#3b82f6",
  "#ef4444", "#22c55e", "#a855f7", "#0ea5e9", "#f97316",
];
