import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { normalizeRole } from "@/lib/rbac";
import { getLocalDateString } from "@/lib/attendance-date";
import {
  getAttendanceDailyReport,
  getAttendanceRangeReport
} from "@/lib/attendance-daily-report";

function parseDateParam(p: string | null): string {
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  return getLocalDateString();
}

function parseDateLike(p: string | null, fallback: string): string {
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  return fallback;
}

function getAttendanceStatus(row: {
  hasLog: boolean;
  clockIn: string | null;
  clockOut: string | null;
}): "present" | "working" | "absent" {
  if (!row.hasLog) return "absent";
  if (row.clockIn && !row.clockOut) return "working";
  return "present";
}

function csvEscape(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  return `"${str.replaceAll('"', '""')}"`;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeRole(payload.role);
  if (role !== "admin" && role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (role === "manager" && payload.departmentId == null) {
    return NextResponse.json(
      { error: "Manager account has no department assigned." },
      { status: 403 }
    );
  }

  const date = parseDateParam(req.nextUrl.searchParams.get("date"));
  const modeRaw = (req.nextUrl.searchParams.get("mode") ?? "daily").toLowerCase();
  const mode = modeRaw === "range" ? "range" : "daily";
  const fromDate = parseDateLike(req.nextUrl.searchParams.get("from"), date);
  const toDate = parseDateLike(req.nextUrl.searchParams.get("to"), date);
  const normalizedFrom = fromDate <= toDate ? fromDate : toDate;
  const normalizedTo = fromDate <= toDate ? toDate : fromDate;
  const search = (req.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase();
  const statusRaw = (req.nextUrl.searchParams.get("status") ?? "all").toLowerCase();
  const departmentRaw = req.nextUrl.searchParams.get("departmentId");
  const statusFilter =
    statusRaw === "present" || statusRaw === "working" || statusRaw === "absent"
      ? statusRaw
      : "all";
  const departmentFilter =
    departmentRaw && /^\d+$/.test(departmentRaw) ? Number(departmentRaw) : null;
  const format = (req.nextUrl.searchParams.get("format") ?? "json").toLowerCase();
  if (mode === "range") {
    const rangeRows = await getAttendanceRangeReport(normalizedFrom, normalizedTo, {
      role: role === "admin" ? "admin" : "manager",
      departmentId: payload.departmentId
    });
    const filteredRangeRows = rangeRows.filter((row) => {
      const matchesSearch =
        search.length === 0 ||
        row.userName.toLowerCase().includes(search) ||
        row.userEmail.toLowerCase().includes(search);
      const matchesDepartment = departmentFilter == null || row.departmentId === departmentFilter;
      return matchesSearch && matchesDepartment;
    });

    if (format === "csv") {
      const lines: string[] = [];
      lines.push(
        [
          "name",
          "email",
          "presentDays",
          "absentDays",
          "totalWorkMinutes",
          "totalBreakMinutes",
          "totalHours"
        ].join(",")
      );
      for (const row of filteredRangeRows) {
        lines.push(
          [
            csvEscape(row.userName),
            csvEscape(row.userEmail),
            csvEscape(row.presentDays),
            csvEscape(row.absentDays),
            csvEscape(row.totalWorkMinutes),
            csvEscape(row.totalBreakMinutes),
            csvEscape(row.totalHours)
          ].join(",")
        );
      }
      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="attendance-${normalizedFrom}-to-${normalizedTo}.csv"`
        }
      });
    }

    return NextResponse.json({
      mode,
      from: normalizedFrom,
      to: normalizedTo,
      rows: filteredRangeRows
    });
  }

  const rows = await getAttendanceDailyReport(date, {
    role: role === "admin" ? "admin" : "manager",
    departmentId: payload.departmentId
  });
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      search.length === 0 ||
      row.userName.toLowerCase().includes(search) ||
      row.userEmail.toLowerCase().includes(search);
    const matchesStatus =
      statusFilter === "all" || getAttendanceStatus(row) === statusFilter;
    const matchesDepartment = departmentFilter == null || row.departmentId === departmentFilter;
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  if (format === "csv") {
    const lines: string[] = [];
    lines.push(
      [
        "name",
        "email",
        "status",
        "clockIn",
        "clockOut",
        "totalWorkMinutes",
        "totalBreakMinutes",
        "totalHours"
      ].join(",")
    );
    for (const row of filteredRows) {
      lines.push(
        [
          csvEscape(row.userName),
          csvEscape(row.userEmail),
          csvEscape(getAttendanceStatus(row)),
          csvEscape(row.clockIn),
          csvEscape(row.clockOut),
          csvEscape(row.totalWorkMinutes),
          csvEscape(row.totalBreakMinutes),
          csvEscape(row.totalHours)
        ].join(",")
      );
    }
    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${date}.csv"`
      }
    });
  }

  return NextResponse.json({ mode, date, rows: filteredRows });
}
