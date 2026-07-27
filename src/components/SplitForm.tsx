"use client";

import { useMemo, useState, useTransition } from "react";
import { computeSplits, type ShareType } from "@/lib/calculations";
import { formatCentsCompact, parseAmountToCents } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Select, Label, FieldError } from "@/components/ui/Input";
import { CardBody } from "@/components/ui/Card";
import { EqualSplitIcon, ExactIcon, PercentIcon } from "@/components/icons";
import { createTransactionAction } from "@/lib/actions/transaction-actions";

export type SplitFormPerson = {
  id: string;
  name: string;
  colorHex: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export function SplitForm({
  projectId,
  people,
  currencySymbol,
  currencyCode,
  defaultPaidById,
}: {
  projectId: string;
  people: SplitFormPerson[];
  currencySymbol: string;
  currencyCode: string;
  defaultPaidById: string | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidById, setPaidById] = useState(defaultPaidById ?? people[0]?.id ?? "");
  const [occurredAt, setOccurredAt] = useState(today());

  const [shareType, setShareType] = useState<ShareType>("equal");
  // selected: participants. values: per-person split input.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(people.map((p) => p.id)),
  );
  const [values, setValues] = useState<Record<string, string>>({});

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const participantsForCalc = useMemo(() => {
    const list = people.filter((p) => selected.has(p.id));
    return list.map((p) => {
      let value = 0;
      if (shareType === "exact") {
        try {
          value = parseAmountToCents(values[p.id] ?? "0");
        } catch {
          value = 0;
        }
      } else if (shareType === "percentage") {
        const raw = values[p.id] ?? "0";
        const n = parseFloat(raw);
        value = Number.isFinite(n) ? Math.round(n * 100) : 0;
      }
      return { personId: p.id, name: p.name, value };
    });
  }, [people, selected, values, shareType]);

  const preview = useMemo(() => {
    if (selected.size === 0) return { error: "Pick at least one person.", rows: [] as ReturnType<typeof computeSplits>, totalCents: 0 };
    let totalCents = 0;
    try {
      totalCents = parseAmountToCents(totalAmount || "0");
    } catch {
      return { error: "Enter a valid total amount.", rows: [] as ReturnType<typeof computeSplits>, totalCents: 0 };
    }
    if (totalCents <= 0)
      return { error: "Total must be greater than zero.", rows: [] as ReturnType<typeof computeSplits>, totalCents };
    try {
      const rows = computeSplits(totalCents, shareType, participantsForCalc);
      return { error: null as string | null, rows, totalCents };
    } catch (err) {
      return { error: (err as Error).message, rows: [] as ReturnType<typeof computeSplits>, totalCents };
    }
  }, [totalAmount, shareType, participantsForCalc]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setValue(id: string, raw: string) {
    setValues((v) => ({ ...v, [id]: raw }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (preview.error) {
      setError(preview.error);
      return;
    }
    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("category", category);
    formData.set("totalAmount", totalAmount);
    formData.set("paidById", paidById);
    formData.set("occurredAt", occurredAt);
    formData.set("shareType", shareType);
    formData.set(
      "participants",
      JSON.stringify(participantsForCalc.map((p) => ({ personId: p.personId, value: p.value }))),
    );

    startTransition(async () => {
      const res = await createTransactionAction(projectId, formData);
      if (res?.error) setError(res.error);
    });
  }

  const exactSum = participantsForCalc.reduce((s, p) => s + p.value, 0);
  const percentSum = participantsForCalc.reduce((s, p) => {
    const raw = values[p.personId] ?? "0";
    const n = parseFloat(raw);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title" required>Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dinner at Sushi Place"
            required
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="category">Category (optional)</Label>
          <Input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Food, Travel, Lodging…"
          />
        </div>
        <div>
          <Label htmlFor="totalAmount" required>Total amount ({currencyCode})</Label>
          <Input
            id="totalAmount"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="e.g. 45.00"
            inputMode="decimal"
            required
          />
        </div>
        <div>
          <Label htmlFor="paidById" required>Paid by</Label>
          <Select
            id="paidById"
            value={paidById}
            onChange={(e) => setPaidById(e.target.value)}
            required
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="occurredAt">Date</Label>
          <Input
            id="occurredAt"
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short note about this transaction"
          />
        </div>
      </div>

      <div>
        <Label>Split mode</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ModeCard
            active={shareType === "equal"}
            onClick={() => setShareType("equal")}
            title="Equal"
            description="Divide evenly among participants"
            icon={<EqualSplitIcon />}
          />
          <ModeCard
            active={shareType === "exact"}
            onClick={() => setShareType("exact")}
            title="Exact"
            description={`Enter the exact ${currencyCode} amount per person`}
            icon={<ExactIcon />}
          />
          <ModeCard
            active={shareType === "percentage"}
            onClick={() => setShareType("percentage")}
            title="Percentage"
            description="Specify % per person (must sum to 100%)"
            icon={<PercentIcon />}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold">Participants</h3>
          <div className="text-xs text-gray-500">
            {selected.size} of {people.length} selected
          </div>
        </div>
        <CardBody>
          <div className="space-y-2">
            {people.map((p) => {
              const isSel = selected.has(p.id);
              const val = values[p.id] ?? "";
              return (
                <div
                  key={p.id}
                  className={
                    "flex items-center gap-3 p-2 rounded-lg transition " +
                    (isSel ? "bg-brand-50" : "bg-gray-50 opacity-70")
                  }
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(p.id)}
                    className="rounded text-brand-600 focus:ring-brand-300 w-4 h-4"
                  />
                  <span className="w-32 truncate font-medium text-sm">{p.name}</span>
                  {isSel && shareType === "exact" && (
                    <div className="flex items-center gap-1 flex-1 max-w-xs">
                      <span className="text-sm text-gray-500">{currencySymbol}</span>
                      <Input
                        value={val}
                        onChange={(e) => setValue(p.id, e.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                        className="!py-1 !px-2 text-right"
                      />
                    </div>
                  )}
                  {isSel && shareType === "percentage" && (
                    <div className="flex items-center gap-1 flex-1 max-w-xs">
                      <Input
                        value={val}
                        onChange={(e) => setValue(p.id, e.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                        className="!py-1 !px-2 text-right"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  )}
                  {isSel && shareType === "equal" && (
                    <span className="text-xs text-gray-400 ml-auto">
                      =
                    </span>
                  )}
                  <div className="ml-auto w-24 text-right font-mono text-sm">
                    {isSel && preview.rows.length > 0 && (() => {
                      const row = preview.rows.find((r) => r.personId === p.id);
                      return row ? formatCentsCompact(row.owedAmountCents, currencySymbol) : "—";
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {shareType === "exact" && (
            <p className="text-xs text-gray-500 mt-3">
              Sum of exact amounts: {currencySymbol}{(exactSum / 100).toFixed(2)} /{" "}
              {formatCentsCompact(preview.totalCents, currencySymbol)}{" "}
              {exactSum === preview.totalCents ? "✓" : "(must match total)"}
            </p>
          )}
          {shareType === "percentage" && (
            <p className="text-xs text-gray-500 mt-3">
              Sum of percentages: {percentSum.toFixed(2)}%{" "}
              {Math.abs(percentSum - 100) < 0.01 ? "✓" : "(must sum to 100%)"}
            </p>
          )}
        </CardBody>
      </div>

      <FieldError>{error ?? preview.error}</FieldError>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending || !!preview.error}>
          {isPending ? "Saving…" : "Save transaction"}
        </Button>
      </div>
    </form>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  description,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "p-3 rounded-lg border text-left transition flex items-start gap-3 " +
        (active
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
          : "border-gray-200 hover:border-gray-300 bg-white")
      }
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
    </button>
  );
}
