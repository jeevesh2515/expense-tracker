"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label, FieldError } from "@/components/ui/Input";
import { CurrencyNotice } from "@/components/CurrencyNotice";
import { createProjectAction, type ProjectActionState } from "@/lib/actions/project-actions";

const initial: ProjectActionState = { error: null };

export function NewProjectForm() {
  const [state, action] = useFormState(createProjectAction, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name" required>Name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Tokyo Trip 2026"
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="A short note about this project"
        />
      </div>
      <CurrencyNotice className="-mt-2" />
      <FieldError>{state.error}</FieldError>
      <div className="flex justify-end gap-2 pt-2">
        <Link href="/dashboard">
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
        <Button type="submit">Create project</Button>
      </div>
    </form>
  );
}
