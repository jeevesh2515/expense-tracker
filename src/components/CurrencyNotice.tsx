import { DEFAULT_CURRENCY } from "@/lib/utils";

/**
 * Single source of truth for the locked-currency notice shown in forms.
 * If the app ever unlocks multi-currency again, this is the one place to
 * update instead of grepping for "₹" across the codebase.
 */
export function CurrencyNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-gray-500 ${className}`.trim()}>
      Currency:{" "}
      <strong>
        {DEFAULT_CURRENCY.symbol} ({DEFAULT_CURRENCY.code})
      </strong>
    </p>
  );
}
