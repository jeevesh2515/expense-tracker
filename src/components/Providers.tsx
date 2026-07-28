"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "dark:bg-gray-900 dark:text-white dark:border-gray-800",
          }}
          richColors
          closeButton
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
