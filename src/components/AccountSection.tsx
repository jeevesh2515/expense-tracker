"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { User, AlertTriangle, Trash2, Calendar, Folder } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { deleteAccountAction } from "@/lib/actions/user-actions";
import { signOut } from "next-auth/react";

type Props = {
  userId: string;
  userName: string;
  userEmail: string;
  userCreatedAt: Date | number;
};

export function AccountSection({ userId, userName, userEmail, userCreatedAt }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDeleteAccount() {
    setShowDeleteConfirm(false);
    startTransition(async () => {
      const res = await deleteAccountAction();
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Account deleted successfully");
        await signOut({ callbackUrl: "/login" });
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <User className="w-4 h-4" /> Account
          </h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <Calendar className="w-3 h-3" />
                Member since
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(userCreatedAt)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                <Folder className="w-3 h-3" />
                Email
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {userEmail}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" /> Danger Zone
          </h3>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isPending}
          >
            <Trash2 className="w-4 h-4" />
            Delete account
          </Button>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete your account "${userName}"?`}
        description="This will permanently delete your account, all projects, transactions, people, and payment records. This action cannot be undone."
        confirmLabel="Delete my account"
        onConfirm={handleDeleteAccount}
        loading={isPending}
      />
    </>
  );
}
