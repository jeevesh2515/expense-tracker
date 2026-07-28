import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { Plus, Folder, Calendar, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { projects, transactions, people } from "@/lib/db/schema";
import { requireUser } from "@/lib/server-utils";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { DashboardStats } from "@/components/DashboardStats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(desc(projects.createdAt))
    .all();

  // Compute stats with single queries (no N+1)
  const projectIds = userProjects.map((p) => p.id);

  let totalTransactions = 0;
  let totalAmountCents = 0;
  let totalPeopleCount = 0;

  if (projectIds.length > 0) {
    const allTxns = await db
      .select()
      .from(transactions)
      .where(inArray(transactions.projectId, projectIds))
      .all();
    totalTransactions = allTxns.length;
    totalAmountCents = allTxns.reduce((s, t) => s + t.totalAmountCents, 0);

    const allPeople = await db
      .select()
      .from(people)
      .where(inArray(people.projectId, projectIds))
      .all();
    totalPeopleCount = allPeople.length;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1>Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Welcome back, <span className="font-medium text-gray-900 dark:text-white">{user.name}</span>
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4" /> New project
          </Button>
        </Link>
      </div>

      {userProjects.length > 0 && (
        <DashboardStats
          totalProjects={userProjects.length}
          totalTransactions={totalTransactions}
          totalPeople={totalPeopleCount}
          totalAmountCents={totalAmountCents}
          currencySymbol="₹"
        />
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Projects</h2>
        {userProjects.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-12">
                <Folder className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="mb-2 dark:text-white">No projects yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
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
            {userProjects.map((p, i) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="card hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all duration-200 group animate-slide-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                      {p.name}
                    </h3>
                    <span className="badge badge-brand">{p.currencyCode}</span>
                  </div>
                  {p.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                      {p.description}
                    </p>
                  )}
                  <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Created {formatDate(p.createdAt)}
                    <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
