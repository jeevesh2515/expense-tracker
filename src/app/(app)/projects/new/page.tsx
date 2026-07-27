import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { NewProjectForm } from "@/components/NewProjectForm";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to projects
        </Link>
        <h1>New project</h1>
        <p className="text-sm text-gray-500 mt-1">
          A project is a self-contained expense tracker (a trip, a roommate group, etc.).
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Project details</h2>
        </CardHeader>
        <CardBody>
          <NewProjectForm />
        </CardBody>
      </Card>
    </div>
  );
}
