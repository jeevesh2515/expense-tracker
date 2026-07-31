"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/people`, label: "People" },
    { href: `${base}/transactions`, label: "Transactions" },
    { href: `${base}/export`, label: "Export" },
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <nav className="-mb-px flex gap-1">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all duration-200 ease-out select-none",
                active
                  ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-300 bg-brand-50/50 dark:bg-brand-950/40"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-gray-800/60 hover:border-gray-300 dark:hover:border-gray-600",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
