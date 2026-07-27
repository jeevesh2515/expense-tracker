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
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex gap-1">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition",
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-200",
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
