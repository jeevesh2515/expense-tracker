"use client";

import { useFormState } from "react-dom";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import {
  createPersonAction,
  type PeopleActionState,
} from "@/lib/actions/people-actions";

const initial: PeopleActionState = { error: null };

export function NewPersonForm({ projectId }: { projectId: string }) {
  const bound = createPersonAction.bind(null, projectId);
  const [state, action] = useFormState(bound, initial);
  const prevErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevErrorRef.current !== null && state.error === null) {
      toast.success("Person added successfully");
    }
    prevErrorRef.current = state.error;
  }, [state.error]);

  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="name" required>Name</Label>
        <Input id="name" name="name" required placeholder="Alice" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          name="isMe"
          className="rounded text-brand-600 focus:ring-brand-300"
        />
        <span>This is me</span>
      </label>
      <Button type="submit" className="w-full">
        Add
      </Button>
      <FieldError>{state.error}</FieldError>
      <p className="text-xs text-gray-400">
        Tip: You can mark one person as &quot;you&quot; to keep track of which entries represent you.
      </p>
    </form>
  );
}
