import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server-utils";
import { buildAllProjectsWorkbook } from "@/lib/excel-export";

// Vercel Hobby = 10s default, Pro = 60s. Multi-project .xlsx assembly needs
// headroom; bump to Pro if you're hitting the 60s ceiling.
export const maxDuration = 60;

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const user = await requireUser();
  const buf = await buildAllProjectsWorkbook(user.id);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="splittrack-export.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
