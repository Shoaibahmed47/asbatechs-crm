"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { Activity, BarChart3, CalendarRange, Loader2, UserCircle, X } from "lucide-react";
import { toast } from "sonner";

import {
  AttendanceDateRangeCalendar,
  formatAttendanceRangeLabel
} from "@/components/attendance/AttendanceDateRangeCalendar";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import {
  ATTENDANCE_TIME_ZONE,
  enumerateLocalDates,
  formatAttendanceClock,
  formatAttendanceDateTime,
  getLocalDateString
} from "@/lib/attendance-date";
import type { AttendanceEmployeeDetail } from "@/lib/attendance-employee-detail";
import { MAX_ATTENDANCE_PERIOD_DAYS } from "@/lib/attendance-policy";
import { addAttendanceCalendarDays } from "@/lib/attendance-working-days";
import { clearInteractionLocks } from "@/lib/dom-interaction-locks";
import {
  agentStateHintForDisplay,
  labelForDisplayAgentState,
  toneForDisplayAgentState
} from "@/lib/attendance-agent-health-display";
import { cn } from "@/lib/utils";

type Props = {
  userId: number;
  userName: string;
  date: string;
  onClose: () => void;
};

function formatClock(iso: string | null): string {
  return formatAttendanceDateTime(iso);
}

function formatShiftClock(iso: string | null): string {
  return formatAttendanceClock(iso);
}

function formatMinutes(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return "—";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

/** Decimal hours (0.07) are easy to misread as "7h" — show minutes first. */
function formatTotalWorkHours(detail: AttendanceEmployeeDetail): string {
  if (detail.totalWorkMinutes <= 0 && detail.totalHours == null) return "—";
  const decimal =
    detail.totalHours ?? (detail.totalWorkMinutes / 60).toFixed(2);
  return `${formatMinutes(detail.totalWorkMinutes)} (${decimal}h)`;
}

function toneForStatus(status: string): string {
  if (status === "active") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  if (status === "break") return "bg-amber-500/15 text-amber-900 dark:text-amber-300";
  if (status === "idle") return "bg-rose-500/15 text-rose-800 dark:text-rose-300";
  return "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
}

function attendanceStatusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "break") return "Break";
  if (status === "idle") return "Inactive";
  return "Offline";
}

function toneForAgent(state: string): string {
  return toneForDisplayAgentState(state as "not_installed" | "installed" | "running" | "stale");
}

function agentStateHint(state: string): string {
  return agentStateHintForDisplay(state as "not_installed" | "installed" | "running" | "stale");
}

function formatDayHeading(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    timeZone: ATTENDANCE_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function DetailStatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm transition hover:border-sky-200/80 dark:border-slate-700/80 dark:bg-slate-900/70 dark:hover:border-sky-800/50">
      <div className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children
}: {
  icon: typeof Activity;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
          {title}
        </h3>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDocMetricsTable(
  items: { label: string; value: string; accent: string }[]
): string {
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const chunk = items.slice(i, i + 2);
    const cells = chunk
      .map(
        (m) => `<td width="50%" valign="top" style="border:1px solid #e2e8f0;border-top:3px solid ${m.accent};padding:8px 10px;background:#ffffff;">
        <div style="font-size:9pt;font-weight:700;text-transform:uppercase;color:#64748b;">${escapeHtml(m.label)}</div>
        <div style="margin-top:3px;font-size:11pt;font-weight:700;color:#0f172a;">${escapeHtml(m.value)}</div>
      </td>`
      )
      .join("");
    const emptyCell = chunk.length === 1 ? '<td width="50%" style="border:none;"></td>' : "";
    rows.push(`<tr>${cells}${emptyCell}</tr>`);
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px;table-layout:fixed;">${rows.join("")}</table>`;
}

const DOC_TH =
  "padding:5px 6px;font-size:8.5pt;text-transform:uppercase;font-weight:bold;word-wrap:break-word;";
const DOC_TD =
  "padding:5px 6px;border-top:1px solid #e2e8f0;font-size:9.5pt;word-wrap:break-word;overflow-wrap:break-word;";

function buildAttendanceReportDocumentHtml(params: {
  userName: string;
  detail: AttendanceEmployeeDetail;
  activeDate: string;
  breakSessions: AttendanceEmployeeDetail["breakSessions"];
  logoOrigin: string;
}): string {
  const { userName, detail, activeDate, breakSessions, logoOrigin } = params;
  const period = detail.periodSummary;
  const isPeriodReport = Boolean(period);

  const breakRowsHtml = breakSessions
    .map((row, index) => {
      const start = formatAttendanceClock(row.breakStart);
      const end = row.breakEnd ? formatAttendanceClock(row.breakEnd) : "Open";
      const duration =
        row.durationMinutes != null
          ? `${row.durationMinutes} min`
          : row.breakEnd
            ? "—"
            : "Ongoing";
      const reasonNote = [row.reasonLabel, row.returnReason?.trim(), row.unscheduledCause]
        .filter((part) => part && String(part).trim())
        .join(" · ");
      const rowBg = index % 2 === 1 ? "background:#f8fafc;" : "";
      return `<tr>
          <td width="11%" style="${DOC_TD}${rowBg}">${escapeHtml(String(row.logDate ?? activeDate))}</td>
          <td width="12%" style="${DOC_TD}${rowBg}">${escapeHtml(start)}</td>
          <td width="12%" style="${DOC_TD}${rowBg}">${escapeHtml(end)}</td>
          <td width="10%" style="${DOC_TD}${rowBg}">${escapeHtml(duration)}</td>
          <td width="10%" style="${DOC_TD}${rowBg}">${escapeHtml(String(row.breakType ?? "—"))}</td>
          <td width="45%" style="${DOC_TD}${rowBg}">${escapeHtml(reasonNote || "—")}</td>
        </tr>`;
    })
    .join("");

  const dailyRowsHtml = period
    ? period.dailyRows
        .map((row, index) => {
          const rowStyle = [
            index % 2 === 1 ? "background:#f8fafc;" : "",
            row.hasLog ? "" : "color:#94a3b8;font-style:italic;"
          ]
            .filter(Boolean)
            .join("");
          const cellStyle = `${DOC_TD}${rowStyle}`;
          return `<tr>
          <td width="12%" style="${cellStyle}">${escapeHtml(row.date)}</td>
          <td width="14%" style="${cellStyle}">${escapeHtml(row.hasLog ? formatAttendanceClock(row.clockIn) : "—")}</td>
          <td width="14%" style="${cellStyle}">${escapeHtml(row.hasLog ? formatAttendanceClock(row.clockOut) : "—")}${row.openShift ? " (open)" : ""}</td>
          <td width="12%" style="${cellStyle}">${escapeHtml(row.hasLog ? formatMinutes(row.totalWorkMinutes) : "—")}</td>
          <td width="12%" style="${cellStyle}">${escapeHtml(row.hasLog ? formatMinutes(row.totalBreakMinutes) : "—")}</td>
          <td width="12%" style="${cellStyle}">${escapeHtml(row.hasLog ? formatMinutes(row.unscheduledIdleMinutes) : "—")}</td>
          <td width="12%" style="${cellStyle}">${escapeHtml(row.hasLog ? formatMinutes(row.sleepMinutes) : "—")}</td>
        </tr>`;
        })
        .join("")
    : "";

  const statusKey = detail.attendanceStatus;
  const statusLabel = isPeriodReport ? "Period report" : attendanceStatusLabel(statusKey);
  const statusColor = isPeriodReport
    ? "#0f3d67"
    : statusKey === "active"
      ? "#047857"
      : statusKey === "break"
        ? "#b45309"
        : statusKey === "idle"
          ? "#be123c"
          : "#475569";
  const statusBg = isPeriodReport
    ? "#e0f2fe"
    : statusKey === "active"
      ? "#d1fae5"
      : statusKey === "break"
        ? "#fef3c7"
        : statusKey === "idle"
          ? "#ffe4e6"
          : "#e2e8f0";

  const logoUrl = `${logoOrigin}/brand-icon.png`;
  const generatedAt = new Date().toLocaleString(undefined, {
    timeZone: ATTENDANCE_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  });

  const rangeLabel = isPeriodReport
    ? formatAttendanceRangeLabel(period!.from, period!.to)
    : formatDayHeading(activeDate);

  const metricItems = isPeriodReport
    ? [
        { label: "Days in range", value: String(period!.dayCount), accent: "#0ea5e9" },
        { label: "Days present", value: String(period!.daysWithAttendance), accent: "#22c55e" },
        { label: "Days absent", value: String(period!.daysAbsent), accent: "#ef4444" },
        { label: "Total work", value: formatMinutes(period!.totals.totalWorkMinutes), accent: "#22c55e" },
        { label: "Total break", value: formatMinutes(period!.totals.totalBreakMinutes), accent: "#f59e0b" },
        {
          label: "Total inactive",
          value: formatMinutes(period!.totals.unscheduledIdleMinutes),
          accent: "#ef4444"
        },
        { label: "Total sleep", value: formatMinutes(period!.totals.sleepMinutes), accent: "#8b5cf6" },
        {
          label: "Avg work / day",
          value:
            period!.daysWithAttendance > 0
              ? formatMinutes(
                  Math.round(period!.totals.totalWorkMinutes / period!.daysWithAttendance)
                )
              : "—",
          accent: "#0f3d67"
        }
      ]
    : [
        { label: "Clock In", value: formatAttendanceClock(detail.clockIn), accent: "#0ea5e9" },
        { label: "Clock Out", value: formatAttendanceClock(detail.clockOut), accent: "#0ea5e9" },
        { label: "Total Work", value: formatTotalWorkHours(detail), accent: "#22c55e" },
        { label: "Break", value: formatMinutes(detail.totalBreakMinutes), accent: "#f59e0b" },
        { label: "Inactive", value: formatMinutes(detail.unscheduledIdleMinutes), accent: "#ef4444" },
        { label: "Sleep", value: formatMinutes(detail.sleepMinutes), accent: "#8b5cf6" },
        {
          label: "Total Hours",
          value: detail.totalHours != null ? `${detail.totalHours} h` : "—",
          accent: "#0f3d67"
        }
      ];

  const metricsTableHtml = buildDocMetricsTable(metricItems);

  const dailySection = isPeriodReport
    ? `
  <p style="margin:20px 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0f3d67;">Daily attendance — ${escapeHtml(formatAttendanceRangeLabel(period!.from, period!.to))}</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:9.5pt;border:1px solid #e2e8f0;table-layout:fixed;">
    <thead>
      <tr style="background-color:#0f3d67;color:#ffffff;">
        <th width="12%" align="left" style="${DOC_TH}">Date</th>
        <th width="14%" align="left" style="${DOC_TH}">Clock in</th>
        <th width="14%" align="left" style="${DOC_TH}">Clock out</th>
        <th width="12%" align="left" style="${DOC_TH}">Work</th>
        <th width="12%" align="left" style="${DOC_TH}">Break</th>
        <th width="12%" align="left" style="${DOC_TH}">Inactive</th>
        <th width="12%" align="left" style="${DOC_TH}">Sleep</th>
      </tr>
    </thead>
    <tbody>${dailyRowsHtml}</tbody>
  </table>`
    : `
  <p style="margin:20px 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0f3d67;">Daily Metrics — ${escapeHtml(activeDate)}</p>
  ${metricsTableHtml}
  <p style="margin-top:12px;font-size:13px;color:#334155;background:#f1f5f9;padding:10px 14px;border:1px solid #e2e8f0;"><strong>Reason:</strong> ${escapeHtml(detail.attendanceReason)}</p>`;

  const periodMetricsBlock = isPeriodReport
    ? `<p style="margin:20px 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0f3d67;">Period totals</p>
  ${metricsTableHtml}
  <p style="margin-top:8px;font-size:12px;color:#64748b;">${period!.daysWithAttendance} day(s) with attendance · ${period!.daysAbsent} absent · up to ${MAX_ATTENDANCE_PERIOD_DAYS} days per export</p>`
    : "";

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="AsbaTechs CRM" />
  <title>AsbaTechs CRM — Attendance Report</title>
  <!--[if gte mso 9]><xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml><![endif]-->
  <style>${buildAttendanceReportPdfStyles()}</style>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;background:#ffffff;">
  <div class="Section1">
  <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
    <tr>
      <td style="padding:0;">
        <table width="100%" cellpadding="10" cellspacing="0" style="background-color:#0f3d67;table-layout:fixed;">
          <tr>
            <td width="44" valign="middle" style="padding-right:8px;">
              <img src="${escapeHtml(logoUrl)}" alt="AsbaTechs CRM" width="36" height="36" style="display:block;width:36px;height:36px;border:0;" />
            </td>
            <td valign="middle">
              <div style="font-size:14pt;font-weight:700;color:#f8fafc;line-height:1.2;">AsbaTechs CRM</div>
              <div style="font-size:8pt;text-transform:uppercase;letter-spacing:1px;color:#bae6fd;margin-top:2px;">Operations Platform</div>
            </td>
            <td width="34%" align="right" valign="middle" style="color:#cbd5e1;font-size:9pt;word-wrap:break-word;">
              <div style="font-size:10pt;font-weight:600;color:#f8fafc;margin-bottom:2px;">${isPeriodReport ? "Period Attendance Report" : "Attendance Report"}</div>
              <div>Generated ${escapeHtml(generatedAt)}</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="10" cellspacing="0" style="margin-top:12px;border:1px solid #e2e8f0;border-left:4px solid #0ea5e9;background:#f8fafc;table-layout:fixed;">
          <tr>
            <td valign="middle" style="word-wrap:break-word;">
              <div style="font-size:13pt;font-weight:700;color:#0f172a;">${escapeHtml(userName)}</div>
              <div style="font-size:9.5pt;color:#475569;margin-top:2px;">${escapeHtml(detail.userEmail)}</div>
              <div style="font-size:9.5pt;color:#475569;margin-top:2px;">${escapeHtml(rangeLabel)}</div>
            </td>
            <td width="22%" align="right" valign="middle">
              <span style="display:inline-block;padding:5px 10px;border-radius:999px;font-size:9pt;font-weight:700;color:${statusColor};background:${statusBg};">${escapeHtml(statusLabel)}</span>
            </td>
          </tr>
        </table>

        ${periodMetricsBlock}
        ${dailySection}

        <p style="margin:16px 0 6px;font-size:10pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0f3d67;">Break Sessions (${breakSessions.length})</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:9.5pt;border:1px solid #e2e8f0;table-layout:fixed;">
          <thead>
            <tr style="background-color:#0f3d67;color:#ffffff;">
              <th width="11%" align="left" style="${DOC_TH}">Date</th>
              <th width="12%" align="left" style="${DOC_TH}">Start</th>
              <th width="12%" align="left" style="${DOC_TH}">End</th>
              <th width="10%" align="left" style="${DOC_TH}">Duration</th>
              <th width="10%" align="left" style="${DOC_TH}">Type</th>
              <th width="45%" align="left" style="${DOC_TH}">Reason</th>
            </tr>
          </thead>
          <tbody>${breakRowsHtml || '<tr><td colspan="6" align="center" style="padding:12px;color:#94a3b8;font-size:9.5pt;">No break sessions recorded</td></tr>'}</tbody>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid #e2e8f0;table-layout:fixed;">
          <tr>
            <td width="50%" style="padding-top:10px;font-size:8.5pt;color:#94a3b8;word-wrap:break-word;">AsbaTechs CRM · Confidential attendance record</td>
            <td width="50%" align="right" style="padding-top:10px;font-size:8.5pt;color:#94a3b8;word-wrap:break-word;">${escapeHtml(userName)} · ${escapeHtml(isPeriodReport ? `${period!.from} – ${period!.to}` : activeDate)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  </div>
</body>
</html>`;
}

const PERIOD_PRESETS = [
  { label: "7 days", offset: -6 },
  { label: "14 days", offset: -13 },
  { label: "30 days", offset: -29 },
  { label: "90 days", offset: -89 },
  { label: "This month", offset: null as number | null }
] as const;

function getPresetRange(offset: number | null): { from: string; to: string } {
  const today = getLocalDateString();
  if (offset == null) {
    return { from: `${today.slice(0, 8)}01`, to: today };
  }
  return { from: addAttendanceCalendarDays(today, offset), to: today };
}

function buildAttendanceReportPdfStyles(): string {
  return `
    @page Section1 {
      size: 21cm 29.7cm;
      margin: 1.5cm 1.25cm;
    }
    div.Section1 { page: Section1; }
    body { margin: 0; padding: 0; }
    table { border-collapse: collapse; table-layout: fixed; width: 100%; }
    td, th { word-wrap: break-word; overflow-wrap: break-word; }
    @media print { body { padding: 0; } }
  `;
}

export function AttendanceReportEmployeeDetailPanel({
  userId,
  userName,
  date,
  onClose
}: Props) {
  const [detail, setDetail] = useState<AttendanceEmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(date);
  const [dateTo, setDateTo] = useState(date);
  const [activeDate, setActiveDate] = useState(date);
  const [breakPage, setBreakPage] = useState(1);
  const [breakLimit, setBreakLimit] = useState(10);
  const [customDayCount, setCustomDayCount] = useState(7);
  const [draftFrom, setDraftFrom] = useState(date);
  const [draftTo, setDraftTo] = useState(date);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
  }, [dateFrom, dateTo]);

  const isMultiDayRange = dateFrom !== dateTo;

  const breakSessionsSorted = useMemo(() => {
    if (!detail?.breakSessions) return [];
    return [...detail.breakSessions].sort(
      (a, b) => new Date(b.breakStart).getTime() - new Date(a.breakStart).getTime()
    );
  }, [detail?.breakSessions]);

  const breakTotalPages =
    breakSessionsSorted.length === 0 ? 0 : Math.ceil(breakSessionsSorted.length / breakLimit);

  const paginatedBreakSessions = useMemo(() => {
    const start = (breakPage - 1) * breakLimit;
    return breakSessionsSorted.slice(start, start + breakLimit);
  }, [breakSessionsSorted, breakPage, breakLimit]);

  const applyPeriodPreset = useCallback((offset: number | null) => {
    const range = getPresetRange(offset);
    setDateFrom(range.from);
    setDateTo(range.to);
    setActiveDate(range.to);
    setBreakPage(1);
    if (offset != null) {
      setCustomDayCount(Math.abs(offset) + 1);
    }
  }, []);

  const applyCustomDayCount = useCallback(() => {
    const n = Math.max(
      1,
      Math.min(MAX_ATTENDANCE_PERIOD_DAYS, Math.floor(customDayCount) || 1)
    );
    const today = getLocalDateString();
    setDateFrom(addAttendanceCalendarDays(today, -(n - 1)));
    setDateTo(today);
    setActiveDate(today);
    setBreakPage(1);
    setCustomDayCount(n);
  }, [customDayCount]);

  const applyCustomDateRange = useCallback(() => {
    if (!draftFrom || !draftTo) return;
    const today = getLocalDateString();
    let from = draftFrom;
    let to = draftTo;
    if (from > to) {
      [from, to] = [to, from];
    }
    if (to > today) {
      to = today;
    }
    if (from > today) {
      from = today;
    }
    let days = enumerateLocalDates(from, to);
    if (days.length > MAX_ATTENDANCE_PERIOD_DAYS) {
      from = addAttendanceCalendarDays(to, -(MAX_ATTENDANCE_PERIOD_DAYS - 1));
      days = enumerateLocalDates(from, to);
      toast.info(`Maximum ${MAX_ATTENDANCE_PERIOD_DAYS} days — range trimmed.`);
    }
    setDateFrom(from);
    setDateTo(to);
    setActiveDate(to);
    setBreakPage(1);
    setCustomDayCount(days.length);
  }, [draftFrom, draftTo]);

  const copyReport = useCallback(async () => {
    if (!detail) return;
    const lines = [
      `Attendance Detail - ${userName}`,
      `Email: ${detail.userEmail}`,
      isMultiDayRange
        ? `Period: ${formatAttendanceRangeLabel(dateFrom, dateTo)}`
        : `Date: ${activeDate}`,
      `Status: ${detail.attendanceStatus}`,
      `Reason: ${detail.attendanceReason}`,
    ];
    if (detail.periodSummary) {
      const p = detail.periodSummary;
      lines.push(
        `Days present: ${p.daysWithAttendance}`,
        `Days absent: ${p.daysAbsent}`,
        `Total work: ${formatMinutes(p.totals.totalWorkMinutes)}`,
        `Total break: ${formatMinutes(p.totals.totalBreakMinutes)}`
      );
    } else {
      lines.push(
        `Clock in: ${formatShiftClock(detail.clockIn)}`,
        `Clock out: ${formatShiftClock(detail.clockOut)}`,
        `Work: ${formatMinutes(detail.totalWorkMinutes)}`,
        `Break: ${formatMinutes(detail.totalBreakMinutes)}`,
        `Inactive: ${formatMinutes(detail.unscheduledIdleMinutes)}`,
        `Sleep: ${formatMinutes(detail.sleepMinutes)}`,
        `Total hours: ${detail.totalHours != null ? `${detail.totalHours} h` : "—"}`
      );
    }
    lines.push(`Break sessions: ${breakSessionsSorted.length}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Report copied");
    } catch {
      toast.error("Could not copy report");
    }
  }, [activeDate, breakSessionsSorted.length, dateFrom, dateTo, detail, isMultiDayRange, userName]);

  const downloadReport = useCallback(() => {
    if (!detail) return;
    try {
      const html = buildAttendanceReportDocumentHtml({
        userName,
        detail,
        activeDate,
        breakSessions: breakSessionsSorted,
        logoOrigin: window.location.origin
      });
      const blob = new Blob(["\uFEFF", html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${userName.replaceAll(/\s+/g, "-").toLowerCase()}-${isMultiDayRange ? `${dateFrom}_to_${dateTo}` : activeDate}.doc`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Document downloaded");
    } catch {
      toast.error("Could not download report");
    }
  }, [activeDate, breakSessionsSorted, dateFrom, dateTo, detail, isMultiDayRange, userName]);

  const exportPdf = useCallback(() => {
    if (!detail) return;

    const html = buildAttendanceReportDocumentHtml({
      userName,
      detail,
      activeDate,
      breakSessions: breakSessionsSorted,
      logoOrigin: window.location.origin
    });

    try {
      const win = window.open("", "_blank", "width=1100,height=800");
      if (!win || !win.document) {
        toast.error("Pop-up blocked. Allow pop-ups to export PDF.");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch {
          toast.error("Could not open print dialog.");
        }
      }, 400);
    } catch {
      toast.error("Export PDF failed. Please try again.");
    }
  }, [activeDate, breakSessionsSorted, detail, userName]);

  useEffect(() => {
    setDateFrom(date);
    setDateTo(date);
    setActiveDate(date);
    setBreakPage(1);
  }, [date, userId]);

  useEffect(() => {
    setBreakPage(1);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (breakTotalPages > 0 && breakPage > breakTotalPages) {
      setBreakPage(breakTotalPages);
    }
  }, [breakPage, breakTotalPages]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        userId: String(userId),
        date: activeDate,
        from: dateFrom,
        to: dateTo
      });
      const data = await apiFetch<{ detail: AttendanceEmployeeDetail }>(
        `/api/reports/attendance-employee-detail?${q.toString()}`,
        { timeoutMs: 60_000 }
      );
      setDetail(data.detail);
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setError(err.message || "Could not load employee attendance.");
      } else {
        setError("Could not load employee attendance.");
      }
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [userId, activeDate, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClose = useCallback(
    (event?: MouseEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      onClose();
    },
    [onClose]
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    clearInteractionLocks();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      clearInteractionLocks();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [handleClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-5"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default bg-slate-900/40 backdrop-blur-[3px] dark:bg-slate-950/60"
        aria-label="Close attendance detail"
        onPointerDown={(event) => handleClose(event)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-detail-title"
        className="relative z-10 flex w-full max-w-[min(96vw,72rem)] max-h-[min(96dvh,960px)] min-h-[12rem] flex-col overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/5 dark:border-slate-700 dark:bg-slate-950 dark:ring-white/10"
      >
        <header className="relative shrink-0 overflow-hidden border-b border-slate-200/80 px-4 py-4 dark:border-slate-800 sm:px-5">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.9),transparent)] dark:bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_42%)]"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-sky-50 text-sky-700 shadow-sm dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-300">
                <UserCircle className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
                  Attendance detail
                </p>
                <h2
                  id="attendance-detail-title"
                  className="mt-1 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[1.65rem]"
                >
                  {userName}
                </h2>
                <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
                  {detail?.userEmail ?? "Loading…"}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1 font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                    {formatDayHeading(activeDate)}
                  </span>
                  {isMultiDayRange ? (
                    <span className="rounded-full border border-sky-200/80 bg-sky-50 px-2.5 py-1 font-medium text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200">
                      Breaks · {formatAttendanceRangeLabel(dateFrom, dateTo)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close attendance detail"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white/90 text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex min-h-[18rem] items-center justify-center">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/50 px-8 py-7 dark:border-sky-900/50 dark:bg-sky-950/25">
                <Loader2 className="h-10 w-10 animate-spin text-sky-600 dark:text-sky-400" />
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Loading attendance…
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <SectionCard icon={Activity} title="Current status">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-sm font-semibold uppercase",
                      toneForStatus(detail.attendanceStatus)
                    )}
                  >
                    {attendanceStatusLabel(detail.attendanceStatus)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-sm font-semibold uppercase",
                      toneForAgent(detail.agentState)
                    )}
                  >
                    Agent: {detail.agentStateLabel}
                  </span>
                  <span className="inline-flex rounded-full bg-slate-200/80 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Shift: {detail.openShift ? "Open" : "Closed"}
                  </span>
                </div>
                <p className="mt-4 text-base leading-relaxed text-slate-800 dark:text-slate-200">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Reason: </span>
                  {detail.attendanceReason}
                </p>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                  {agentStateHint(detail.agentState)}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                    <dt className="text-base font-medium text-slate-500 dark:text-slate-400">Email</dt>
                    <dd className="mt-0.5 break-all font-medium text-slate-900 dark:text-slate-100">
                      {detail.userEmail}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                    <dt className="text-base font-medium text-slate-500 dark:text-slate-400">
                      Department
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                      {detail.departmentName ?? "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                    <dt className="text-base font-medium text-slate-500 dark:text-slate-400">
                      Last activity
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                      {detail.lastActivityAt ? formatClock(detail.lastActivityAt) : "—"}
                      {detail.lastActivitySource ? ` · ${detail.lastActivitySource}` : ""}
                    </dd>
                  </div>
                </dl>
              </SectionCard>

              <SectionCard icon={CalendarRange} title="Report period">
                <p className="text-base text-slate-600 dark:text-slate-400">
                  Select how many days to include in the report (max {MAX_ATTENDANCE_PERIOD_DAYS}),
                  then export PDF for CEO.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {PERIOD_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 bg-white text-xs dark:bg-slate-900"
                      onClick={() => applyPeriodPreset(preset.offset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                  <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Last N days</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={MAX_ATTENDANCE_PERIOD_DAYS}
                        value={customDayCount}
                        onChange={(e) => setCustomDayCount(Number(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") applyCustomDayCount();
                        }}
                        className="h-9 w-20 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <Button type="button" size="sm" variant="secondary" onClick={applyCustomDayCount}>
                        Apply
                      </Button>
                    </div>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">From</span>
                    <input
                      type="date"
                      value={draftFrom}
                      max={draftTo || getLocalDateString()}
                      onChange={(e) => setDraftFrom(e.target.value)}
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">To</span>
                    <input
                      type="date"
                      value={draftTo}
                      min={draftFrom}
                      max={getLocalDateString()}
                      onChange={(e) => setDraftTo(e.target.value)}
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </label>
                  <Button type="button" size="sm" variant="secondary" onClick={applyCustomDateRange}>
                    Apply range
                  </Button>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Selected:{" "}
                  <span className="text-slate-900 dark:text-slate-100">
                    {formatAttendanceRangeLabel(dateFrom, dateTo)}
                  </span>
                  {isMultiDayRange ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}
                      · {enumerateLocalDates(dateFrom, dateTo).length} day(s)
                    </span>
                  ) : null}
                </p>
                <div className="mt-4">
                  <AttendanceDateRangeCalendar
                    variant="compact"
                    display="inline"
                    autoApply
                    numberOfMonths={2}
                    from={dateFrom}
                    to={dateTo}
                    activeDate={activeDate}
                    onRangeChange={(from, to) => {
                      setDateFrom(from);
                      setDateTo(to);
                      setActiveDate(to);
                      setBreakPage(1);
                      setCustomDayCount(enumerateLocalDates(from, to).length);
                    }}
                    onActiveDateChange={setActiveDate}
                  />
                </div>
              </SectionCard>

              <SectionCard icon={BarChart3} title="Day totals">
                <p className="text-base text-slate-600 dark:text-slate-400">
                  Metrics for{" "}
                  <strong className="text-slate-900 dark:text-slate-100">{activeDate}</strong>
                  {detail.openShift ? " · live until clock-out" : ""}
                  {isMultiDayRange ? (
                    <>
                      {" "}
                      · click a day in <strong>Period summary</strong> below to switch
                    </>
                  ) : null}
                </p>
                {detail.sleepMinutes === 0 && detail.openShift ? (
                  <p className="mt-2 text-base leading-relaxed text-slate-600 dark:text-slate-400">
                    <strong>Sleep</strong> counts laptop <strong>lock</strong> (Win+L), lid close,
                    or OS sleep via desktop agent — not mouse idle or closing tabs (
                    <strong>Inactive</strong>). Test: clock in, sleep laptop ~1 min, wake.
                  </p>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-3">
                  <DetailStatTile label="Clock in" value={formatShiftClock(detail.clockIn)} />
                  <DetailStatTile label="Clock out" value={formatShiftClock(detail.clockOut)} />
                  <DetailStatTile label="Work" value={formatMinutes(detail.totalWorkMinutes)} />
                  <DetailStatTile label="Break" value={formatMinutes(detail.totalBreakMinutes)} />
                  <DetailStatTile label="Inactive" value={formatMinutes(detail.unscheduledIdleMinutes)} />
                  <DetailStatTile label="Sleep" value={formatMinutes(detail.sleepMinutes)} />
                  <DetailStatTile label="Inactive events" value={String(detail.idleEventsCount)} />
                  <DetailStatTile label="Sleep events" value={String(detail.sleepEventsCount)} />
                  <DetailStatTile
                    label="Total work"
                    value={formatTotalWorkHours(detail)}
                  />
                </div>
              </SectionCard>

              {detail.periodSummary ? (
                <SectionCard icon={BarChart3} title="Period summary">
                  <p className="text-base text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-100">
                      {formatAttendanceRangeLabel(detail.periodSummary.from, detail.periodSummary.to)}
                    </strong>
                    {" · "}
                    {detail.periodSummary.daysWithAttendance} day(s) present ·{" "}
                    {detail.periodSummary.daysAbsent} absent
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                    <DetailStatTile
                      label="Total work"
                      value={formatMinutes(detail.periodSummary.totals.totalWorkMinutes)}
                    />
                    <DetailStatTile
                      label="Total break"
                      value={formatMinutes(detail.periodSummary.totals.totalBreakMinutes)}
                    />
                    <DetailStatTile
                      label="Total inactive"
                      value={formatMinutes(detail.periodSummary.totals.unscheduledIdleMinutes)}
                    />
                    <DetailStatTile
                      label="Avg work / day"
                      value={
                        detail.periodSummary.daysWithAttendance > 0
                          ? formatMinutes(
                              Math.round(
                                detail.periodSummary.totals.totalWorkMinutes /
                                  detail.periodSummary.daysWithAttendance
                              )
                            )
                          : "—"
                      }
                    />
                  </div>
                  <div className="mt-4 -mx-1 overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-700">
                    <table className="w-full min-w-[48rem] table-auto text-left text-sm">
                      <thead className="bg-slate-50 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/90 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Clock in</th>
                          <th className="px-3 py-2">Clock out</th>
                          <th className="px-3 py-2">Work</th>
                          <th className="px-3 py-2">Break</th>
                          <th className="px-3 py-2">Inactive</th>
                          <th className="px-3 py-2">Sleep</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detail.periodSummary.dailyRows.map((row) => (
                          <tr
                            key={row.date}
                            className={cn(
                              "cursor-pointer transition hover:bg-sky-50/60 dark:hover:bg-sky-950/20",
                              row.date === activeDate && "bg-sky-50/80 dark:bg-sky-950/30",
                              !row.hasLog && "text-slate-400 italic"
                            )}
                            onClick={() => setActiveDate(row.date)}
                          >
                            <td className="px-3 py-2 font-medium">{row.date}</td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.hasLog ? formatShiftClock(row.clockIn) : "—"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.hasLog ? formatShiftClock(row.clockOut) : "—"}
                              {row.openShift ? " · open" : ""}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.hasLog ? formatMinutes(row.totalWorkMinutes) : "—"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.hasLog ? formatMinutes(row.totalBreakMinutes) : "—"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.hasLog ? formatMinutes(row.unscheduledIdleMinutes) : "—"}
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                              {row.hasLog ? formatMinutes(row.sleepMinutes) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Click a row to view that day&apos;s detail above. Use <strong>PDF</strong> to
                    export the full period for CEO.
                  </p>
                </SectionCard>
              ) : null}

              <SectionCard icon={CalendarRange} title="Break sessions">
                <p className="text-base font-medium text-slate-900 dark:text-slate-100">
                  {breakSessionsSorted.length}{" "}
                  {breakSessionsSorted.length === 1 ? "session" : "sessions"}
                  {isMultiDayRange
                    ? ` · ${formatAttendanceRangeLabel(dateFrom, dateTo)}`
                    : ` · ${activeDate}`}
                </p>
                <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                  Change the report period above to filter break sessions.
                </p>

                {breakSessionsSorted.length === 0 ? (
                  <p className="mt-4 text-base text-slate-500 dark:text-slate-400">
                    {isMultiDayRange
                      ? "No break sessions in this date range."
                      : detail.hasLog
                        ? "No break sessions recorded for this date."
                        : "No attendance log for this date."}
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col">
                    <div className="-mx-1 overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-700">
                      <table className="w-full min-w-[56rem] table-auto text-left text-sm">
                        <thead className="bg-slate-50 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/90 dark:text-slate-400">
                          <tr>
                            {isMultiDayRange ? (
                              <th className="whitespace-nowrap px-3 py-2.5">Date</th>
                            ) : null}
                            <th className="whitespace-nowrap px-3 py-2.5">Start</th>
                            <th className="whitespace-nowrap px-3 py-2.5">End</th>
                            <th className="whitespace-nowrap px-3 py-2.5">Duration</th>
                            <th className="whitespace-nowrap px-3 py-2.5">Type</th>
                            <th className="whitespace-nowrap px-3 py-2.5">Cause</th>
                            <th className="min-w-[10rem] px-3 py-2.5">Return</th>
                            <th className="min-w-[18rem] px-3 py-2.5">Label / details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {paginatedBreakSessions.map((row) => (
                            <tr
                              key={`${row.logDate}-${row.id}`}
                              className="bg-white/50 dark:bg-slate-950/30"
                            >
                            {isMultiDayRange ? (
                              <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                {row.logDate}
                              </td>
                            ) : null}
                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">
                              {formatClock(row.breakStart)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">
                              {row.breakEnd ? formatClock(row.breakEnd) : "Open"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">
                              {row.durationMinutes != null
                                ? `${row.durationMinutes} min`
                                : row.breakEnd
                                  ? "—"
                                  : "Ongoing"}
                            </td>
                            <td className="px-3 py-2.5 capitalize text-slate-700 dark:text-slate-200">
                              {row.breakType}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                              {row.unscheduledCause ?? "—"}
                            </td>
                            <td className="min-w-[10rem] max-w-[14rem] whitespace-normal break-words px-3 py-2.5 align-top text-slate-700 dark:text-slate-200">
                              {row.returnReason?.trim() ? row.returnReason : "—"}
                            </td>
                            <td className="min-w-[18rem] whitespace-normal break-words px-3 py-2.5 align-top font-medium leading-relaxed text-slate-800 dark:text-slate-100">
                              {row.reasonLabel}
                            </td>
                          </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      className="mt-3 shrink-0 border-t-0 pt-0"
                      page={breakPage}
                      totalPages={breakTotalPages}
                      total={breakSessionsSorted.length}
                      limit={breakLimit}
                      onPageChange={setBreakPage}
                      onLimitChange={(n) => {
                        setBreakLimit(n);
                        setBreakPage(1);
                      }}
                      limitOptions={[5, 10, 15, 25]}
                    />
                  </div>
                )}
              </SectionCard>
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200/90 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="shrink-0 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Export &amp; actions
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-white dark:bg-slate-900"
              onClick={() => void copyReport()}
              disabled={loading || !detail}
            >
              Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-white dark:bg-slate-900"
              onClick={() => downloadReport()}
              disabled={loading || !detail}
            >
              Download
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="bg-white dark:bg-slate-900"
              onClick={() => exportPdf()}
              disabled={loading || !detail}
            >
              PDF
            </Button>
            <Button type="button" size="sm" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
