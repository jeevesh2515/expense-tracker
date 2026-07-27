import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server-utils";
import { SignupForm } from "@/components/SignupForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign up · Splittrack" };

export default async function SignupPage() {
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
            <h1 className="text-lg font-semibold">Create your account</h1>
          </div>
          <div className="card-body">
            <SignupForm />
          </div>
        </div>
        <p className="text-center text-xs text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-600 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
