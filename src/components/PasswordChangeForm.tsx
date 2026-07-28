"use client";

import { useFormState } from "react-dom";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Lock, Eye, EyeOff } from "lucide-react";
import { changePasswordAction, type UserActionState } from "@/lib/actions/user-actions";

const initial: UserActionState = { error: null };

export function PasswordChangeForm() {
  const [state, action] = useFormState(changePasswordAction, initial);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const prevErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevErrorRef.current !== null && state.error === null) {
      toast.success("Password changed successfully");
    }
    prevErrorRef.current = state.error;
  }, [state.error]);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="currentPassword" required>Current password</Label>
        <div className="relative">
          <Input
            id="currentPassword"
            name="currentPassword"
            type={showCurrent ? "text" : "password"}
            required
            placeholder="Enter current password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <Label htmlFor="newPassword" required>New password</Label>
        <div className="relative">
          <Input
            id="newPassword"
            name="newPassword"
            type={showNew ? "text" : "password"}
            required
            placeholder="At least 8 characters"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <Label htmlFor="confirmPassword" required>Confirm new password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            required
            placeholder="Re-enter new password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <FieldError>{state.error}</FieldError>
      <div className="flex justify-end">
        <Button type="submit">
          <Lock className="w-4 h-4" />
          Change password
        </Button>
      </div>
    </form>
  );
}
