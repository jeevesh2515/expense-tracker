import { Download, FileSpreadsheet, FileText, Globe, Database } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { requireProject } from "@/lib/server-utils";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ExportPage({ params }: { params: { id: string } }) {
  const project = await requireProject(params.id);
  const safeName = project.name.replace(/[^A-Za-z0-9 _-]/g, "_");

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Download className="w-5 h-5" /> Export
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Download this project as a styled spreadsheet or a flat CSV.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <a
            href={`/api/projects/${project.id}/export?format=xlsx`}
            className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition group"
          >
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600 mt-0.5 group-hover:text-emerald-700" />
              <div>
                <div className="font-semibold text-gray-900">Excel (.xlsx)</div>
                <div className="text-sm text-gray-600 mt-0.5">
                  Multi-sheet workbook: Summary · People · Transactions · Splits · Payments · Balances · Settlements.
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Currency-formatted totals, frozen header rows, color-coded headers.
                </div>
              </div>
            </div>
            <Download className="w-5 h-5 text-gray-400 group-hover:text-brand-600" />
          </a>

          <a
            href={`/api/projects/${project.id}/export?format=csv`}
            className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition group"
          >
            <div className="flex items-start gap-3">
              <FileText className="w-6 h-6 text-blue-600 mt-0.5 group-hover:text-blue-700" />
              <div>
                <div className="font-semibold text-gray-900">CSV (.csv)</div>
                <div className="text-sm text-gray-600 mt-0.5">
                  Flattened rows — one row per transaction+person+payment. Easy to pivot.
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Opens in Excel, Google Sheets, Numbers, or any data tool.
                </div>
              </div>
            </div>
            <Download className="w-5 h-5 text-gray-400 group-hover:text-brand-600" />
          </a>

          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            Project: <strong>{project.name}</strong> · Currency: <strong>{project.currencyCode}</strong> · Created {formatDate(project.createdAt)} ·
            Filename will be: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{safeName}.xlsx</code>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold flex items-center gap-2">
            <Globe className="w-5 h-5" /> Export everything
          </h3>
        </CardHeader>
        <CardBody>
          <a
            href="/api/export?format=xlsx"
            className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition group"
          >
            <div className="flex items-start gap-3">
              <Database className="w-6 h-6 text-purple-600 mt-0.5 group-hover:text-purple-700" />
              <div>
                <div className="font-semibold text-gray-900">All projects (single workbook)</div>
                <div className="text-sm text-gray-600 mt-0.5">
                  Every project, each with its own tabs, in one Excel file. Useful for yearly archives.
                </div>
              </div>
            </div>
            <Download className="w-5 h-5 text-gray-400 group-hover:text-brand-600" />
          </a>
        </CardBody>
      </Card>
    </div>
  );
}
