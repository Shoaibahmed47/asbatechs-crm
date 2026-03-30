import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { adminSnapshotToCsv } from "@/lib/admin-export-csv";
import { getAdminSnapshot } from "@/lib/admin-snapshot";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || (payload.role !== "admin" && payload.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = req.nextUrl.searchParams.get("format");
  if (format !== "csv") {
    return NextResponse.json(
      { error: "Invalid format. Use format=csv" },
      { status: 400 }
    );
  }

  const snapshot = await getAdminSnapshot();
  const csv = adminSnapshotToCsv(snapshot);
  const filename = `crm-admin-export-${snapshot.generatedAt.slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
