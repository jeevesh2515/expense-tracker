"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle2, Trash2, Wallet, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { formatCentsCompact, formatDate } from "@/lib/utils";
import {
  recordPaymentAction,
  markFullyPaidAction,
  deletePaymentAction,
} from "@/lib/actions/payment-actions";
import type { Payment } from "@/lib/db/schema";

export function PersonPaymentCard({
  projectId,
  txnId,
  personId,
  personName,
  personColorHex,
  owed,
  paid,
  remaining,
  status,
  payments,
  currencySymbol,
  currencyCode,
}: {
  projectId: string;
  txnId: string;
  personId: string;
  personName: string;
  personColorHex: string;
  owed: number;
  paid: number;
  remaining: number;
  status: "paid" | "partial" | "unpaid";
  payments: Payment[];
  currencySymbol: string;
  currencyCode: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitPayment() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("personId", personId);
      fd.set("amount", amount);
      fd.set("note", note);
      fd.set("paidAt", paidAt);
      const res = await recordPaymentAction(projectId, txnId, fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      toast.success("Payment recorded successfully");
      setAmount("");
      setNote("");
      setShowAdd(false);
    });
  }

  function markPaid() {
    startTransition(async () => {
      const res = await markFullyPaidAction(projectId, txnId, personId);
      if (!res?.error) toast.success("Marked as fully paid");
    });
  }

  function removePayment(pid: string) {
    if (!confirm("Delete this payment?")) return;
    startTransition(async () => {
      const res = await deletePaymentAction(projectId, txnId, pid);
      if (!res?.error) toast.success("Payment deleted");
    });
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={personName} color={personColorHex} />
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{personName}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Owes {formatCentsCompact(owed, currencySymbol)} · Paid {formatCentsCompact(paid, currencySymbol)}
            </div>
            {payments.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-brand-600 dark:text-brand-400 mt-1 inline-flex items-center gap-0.5"
              >
                {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {payments.length} payment{payments.length === 1 ? "" : "s"} on record
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={
              "text-sm font-semibold " +
              (remaining === 0
                ? "text-emerald-700"
                : remaining < 0
                ? "text-amber-700"
                : "text-red-700")
            }
          >
            {remaining === 0
              ? "Paid"
              : remaining < 0
              ? `Overpaid ${formatCentsCompact(Math.abs(remaining), currencySymbol)}`
              : `Owes ${formatCentsCompact(remaining, currencySymbol)}`}
          </div>
          {status === "paid" ? (
            <span className="badge badge-green"><CheckCircle2 className="w-3 h-3" /> settled</span>
          ) : status === "partial" ? (
            <span className="badge badge-amber">partial</span>
          ) : (
            <span className="badge badge-gray">unpaid</span>
          )}
        </div>
      </div>

      {showHistory && payments.length > 0 && (
        <div className="mt-3 pl-12 space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 group">
              <span className="w-24 font-mono">
                {formatCentsCompact(p.amountCents, currencySymbol)}
              </span>
              <span className="text-gray-500 dark:text-gray-500">{formatDate(p.paidAt)}</span>
              {p.note && <span className="text-gray-400 dark:text-gray-500">— {p.note}</span>}
              <button
                type="button"
                onClick={() => removePayment(p.id)}
                className="ml-auto text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100"
                title="Delete payment"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="mt-3 pl-12 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label>Amount ({currencyCode})</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder={remaining > 0 ? String((remaining / 100).toFixed(2)) : "0.00"}
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Venmo"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submitPayment}
              disabled={isPending || !amount}
            >
              <Plus className="w-3.5 h-3.5" />
              Record payment
            </Button>
          </div>
        </div>
      )}

      {!showAdd && remaining > 0 && (
        <div className="mt-2 flex justify-end gap-2 pl-12">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" />
            Add payment
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={markPaid} disabled={isPending}>
            <Wallet className="w-3.5 h-3.5" />
            Mark fully paid
          </Button>
        </div>
      )}
    </div>
  );
}
