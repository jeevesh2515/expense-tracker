"use client";

import { useFormState } from "react-dom";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Save } from "lucide-react";
import { updateProfileAction, type UserActionState } from "@/lib/actions/user-actions";

const initial: UserActionState = { error: null };

type Props = {
  userId: string;
  name: string;
  email: string;
};

export function SettingsForm({ userId, name, email }: Props) {
  const [state, action] = useFormState(updateProfileAction, initial);
  const prevErrorRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Only show toast when error transitions from non-null to null (successful save)
    if (prevErrorRef.current !== undefined && prevErrorRef.current !== null && state.error === null) {
      toast.success("Profile updated successfully");
    }
    prevErrorRef.current = state.error;
  }, [state.error]);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="settings-name" required>Name</Label>
        <Input
          id="settings-name"
          name="name"
          defaultValue={name}
          placeholder="Your name"
          required
        />
      </div>
      <div>
        <Label htmlFor="settings-email" required>Email</Label>
        <Input
          id="settings-email"
          type="email"
          defaultValue={email}
          placeholder="your@email.com"
          required
          disabled
        />
        <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
      </div>
      <FieldError>{state.error}</FieldError>
      <div className="flex justify-end">
        <Button type="submit">
          <Save className="w-4 h-4" />
          Save changes
        </Button>
      </div>
    </form>
  );
}
