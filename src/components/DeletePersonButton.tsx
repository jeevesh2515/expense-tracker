"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deletePersonAction } from "@/lib/actions/people-actions";

export function DeletePersonButton({
  projectId,
  personId,
  personName,
}: {
  projectId: string;
  personId: string;
  personName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleConfirm() {
    setShowConfirm(false);
    startTransition(async () => {
      const res = await deletePersonAction(projectId, personId);
      if (res?.error) setError(res.error);
      else toast.success(`"${personName}" removed from project`);
    });
  }

  return (
    <>
      <div className="flex flex-col items-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowConfirm(true)}
          disabled={isPending}
          title={error ?? "Delete"}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
        {error && (
          <span className="text-xs text-red-600 mt-1 max-w-[200px] text-right">{error}</span>
        )}
      </div>
      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={`Remove "${personName}"?`}
        description={`This will remove ${personName} from this project. This action cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={handleConfirm}
        loading={isPending}
      />
    </>
  );
}
