import { requireUser } from "@/lib/server-utils";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { SettingsForm } from "@/components/SettingsForm";
import { PasswordChangeForm } from "@/components/PasswordChangeForm";
import { AccountSection } from "@/components/AccountSection";
import { User, Lock, BarChart3, Download, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings · Splittrack" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1>Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your account preferences
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <User className="w-4 h-4" /> Profile
          </h3>
        </CardHeader>
        <CardBody>
          <SettingsForm
            userId={user.id}
            name={user.name}
            email={user.email}
          />
        </CardBody>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <Lock className="w-4 h-4" /> Password
          </h3>
        </CardHeader>
        <CardBody>
          <PasswordChangeForm />
        </CardBody>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <Shield className="w-4 h-4" /> Appearance
          </h3>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use the theme toggle in the top bar to switch between light, dark, and system themes.
            Your preference is saved automatically.
          </p>
        </CardBody>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2 dark:text-white">
            <Download className="w-4 h-4" /> Data Export
          </h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Export your data from any project's Export tab. You can download individual projects as
            Excel workbooks or CSV files, or export all projects at once.
          </p>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm">
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Supported formats:</strong> Excel (.xlsx) with styled sheets, or flat CSV for data analysis.
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-xs">
              Each export includes summaries, people, transactions, splits, payments, balances, and settlements.
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Account */}
      <AccountSection
        userId={user.id}
        userName={user.name}
        userEmail={user.email}
        userCreatedAt={user.createdAt}
      />
    </div>
  );
}
