import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireUser } from "@/lib/server-utils";
import { buildProjectWorkbook, buildProjectCSV } from "@/lib/excel-export";
import { ensureSchema } from "@/lib/db/migrate";

// Vercel Hobby = 10s default, Pro = 60s. Project .xlsx assembly needs headroom.
export const maxDuration = 60;

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await ensureSchema();
  const user = await requireUser();
  const proj = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, user.id)))
    .get();
  if (!proj) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "xlsx").toLowerCase();

  if (format === "csv") {
    const csv = await buildProjectCSV(params.id);
    const safeName = proj.name.replace(/[^A-Za-z0-9 _-]/g, "_");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // default: xlsx
  const buf = await buildProjectWorkbook(params.id);
  const safeName = proj.name.replace(/[^A-Za-z0-9 _-]/g, "_");
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
