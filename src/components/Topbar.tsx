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
        <Link href="/dashboard" className="group flex items-center gap-2.5 transition-all cursor-pointer">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-brand-500/20 group-hover:scale-105 group-hover:rotate-3 transition-all duration-200">
            S
          </div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white leading-none group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Splittrack</div>
            <div className="text-[10px] text-gray-400 leading-none mt-0.5 font-medium">expense tracker</div>
          </div>
        </Link>
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/settings" className="btn btn-ghost p-2 rounded-xl hover:rotate-45 transition-transform duration-300" title="Settings">
                <Settings className="w-4 h-4" />
              </Link>
              <div className="text-right hidden sm:block px-3 py-1 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800/60 hover:border-brand-300 dark:hover:border-brand-700 transition-all cursor-default">
                <div className="text-xs font-semibold text-gray-900 dark:text-white">{user.name}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">{user.email}</div>
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
