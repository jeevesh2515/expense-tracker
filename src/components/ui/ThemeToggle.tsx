"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button className={cn("btn btn-ghost p-2", className)} disabled>
        <div className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(
        "btn btn-ghost p-2 rounded-xl hover:bg-brand-50/80 dark:hover:bg-brand-950/40 hover:rotate-45 hover:scale-110 transition-all duration-300 cursor-pointer",
        className
      )}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="w-4.5 h-4.5 text-amber-400 drop-shadow-sm" />
      ) : (
        <Moon className="w-4.5 h-4.5 text-gray-700 dark:text-gray-300" />
      )}
    </button>
  );
}
