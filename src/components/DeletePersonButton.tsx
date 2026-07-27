"use client";

import { useTransition, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

  function handleDelete() {
    if (!confirm(`Remove "${personName}" from this project?`)) return;
    startTransition(async () => {
      const res = await deletePersonAction(projectId, personId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        title={error ?? "Delete"}
      >
        <Trash2 className="w-4 h-4 text-red-500" />
      </Button>
      {error && (
        <span className="text-xs text-red-600 mt-1 max-w-[200px] text-right">{error}</span>
      )}
    </div>
  );
}
