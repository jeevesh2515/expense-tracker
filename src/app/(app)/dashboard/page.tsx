import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus, Folder, Calendar, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireUser } from "@/lib/server-utils";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1>Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Each project tracks people, transactions, payments, and balances in its own currency.
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4" /> New project
          </Button>
        </Link>
      </div>

      {userProjects.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <Folder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="mb-2">No projects yet</h3>
              <p className="text-gray-500 mb-6">
                Create your first project to start tracking shared expenses.
              </p>
              <Link href="/projects/new">
                <Button>
                  <Plus className="w-4 h-4" /> Create your first project
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userProjects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="card hover:shadow-md hover:border-brand-300 transition group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 group-hover:text-brand-700">
                    {p.name}
                  </h3>
                  <span className="badge badge-brand">{p.currencyCode}</span>
                </div>
                {p.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {p.description}
                  </p>
                )}
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Created {formatDate(p.createdAt)}
                  <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
