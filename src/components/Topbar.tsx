import Link from "next/link";
import { getCurrentUser } from "@/lib/server-utils";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Settings } from "lucide-react";

export async function Topbar() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg sticky top-0 z-30">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">
            S
          </div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white leading-none">Splittrack</div>
            <div className="text-[10px] text-gray-400 leading-none mt-0.5">expense tracker</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/settings" className="btn btn-ghost p-2" title="Settings">
                <Settings className="w-4 h-4" />
              </Link>
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
              </div>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="btn btn-secondary">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
