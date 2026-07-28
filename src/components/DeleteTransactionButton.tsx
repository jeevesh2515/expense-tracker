"use client";

import { useTransition, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  const [showConfirm, setShowConfirm] = useState(false);

  function handleConfirm() {
    setShowConfirm(false);
    startTransition(async () => {
      await onDelete();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </Button>
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={`Delete "${txnTitle}"?`}
        description="This will permanently remove this transaction along with all its splits and payment records. This action cannot be undone."
        confirmLabel="Delete transaction"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}
