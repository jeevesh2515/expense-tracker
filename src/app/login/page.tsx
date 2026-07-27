import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-utils";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · Splittrack" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
            S
          </div>
          <div>
            <div className="font-bold text-xl text-gray-900">Splittrack</div>
            <div className="text-xs text-gray-500">Expense tracker</div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h1 className="text-lg font-semibold">Sign in to your account</h1>
          </div>
          <div className="card-body">
            <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <p className="text-center text-xs text-gray-500 mt-6">
          Need an account?{" "}
          <Link href="/signup" className="text-brand-600 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
