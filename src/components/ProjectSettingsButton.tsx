"use client";

import { useState, useTransition } from "react";
import { Settings, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label, FieldError } from "@/components/ui/Input";
import { CurrencyNotice } from "@/components/CurrencyNotice";
import { updateProjectAction, deleteProjectAction } from "@/lib/actions/project-actions";

type Props = {
  projectId: string;
  projectName: string;
  projectDescription: string;
};

export function ProjectSettingsButton({
  projectId,
  projectName,
  projectDescription,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateProjectAction(projectId, formData);
      if (res?.error) setError(res.error);
      else setOpen(false);
    });
  }

  function handleDelete() {
    if (!confirm(`Delete project "${projectName}"? This permanently removes all transactions, people, and payments.`)) return;
    startTransition(async () => {
      await deleteProjectAction(projectId);
    });
  }

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen(!open)}>
        <Settings className="w-4 h-4" />
        <span>Settings</span>
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => !isPending && setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 z-50 card shadow-xl">
            <div className="card-header">
              <h3 className="font-semibold">Project settings</h3>
            </div>
            <form action={handleSubmit} className="card-body space-y-3">
              <div>
                <Label htmlFor="name" required>Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={projectName}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={projectDescription}
                />
              </div>
              <CurrencyNotice />
              <FieldError>{error}</FieldError>
              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  <Trash2 className="w-4 h-4" /> Delete project
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  <Save className="w-4 h-4" /> Save
                </Button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
