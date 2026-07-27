import { Topbar } from "@/components/Topbar";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Topbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {children}
      </main>
      <footer className="py-6 text-center text-xs text-gray-400">
        Splittrack · Built with Next.js
      </footer>
    </div>
  );
}
