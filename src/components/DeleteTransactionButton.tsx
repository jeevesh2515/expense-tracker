"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function DeleteTransactionButton({
  projectId,
  txnId,
  txnTitle,
  onDelete,
}: {
  projectId: string;
  txnId: string;
  txnTitle: string;
  onDelete: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete transaction "${txnTitle}"? This also removes its splits and payments.`)) return;
    startTransition(async () => {
      await onDelete();
    });
  }

  return (
    <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={isPending}>
      <Trash2 className="w-4 h-4" />
      Delete
    </Button>
  );
}
