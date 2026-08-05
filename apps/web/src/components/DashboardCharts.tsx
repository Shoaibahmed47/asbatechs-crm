"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type TooltipItem
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { LineChart as LineChartIcon } from "lucide-react";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
);

export type DashboardChartPayload = {
  hotLeads: number;
  saleLeads: number;
  totalSalesAmount: number;
  activeToday: number;
  totalUsers: number;
  monthlySales: { month: string; label: string; amount: number }[];
  monthlyNewLeads: { month: string; label: string; count: number }[];
};

const BRAND = {
  teal: "#0f4c45",
  tealLight: "#1a7a6d",
  tealLighter: "#2d9b8a",
  orange: "#e86a17",
  gold: "#c9a227",
  mint: "#2a8f7e"
} as const;

const BAR_COLORS = [
  BRAND.teal,
  BRAND.tealLight,
  BRAND.tealLighter,
  BRAND.orange,
  BRAND.gold,
  BRAND.mint
];

function currencyShort(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function currencyFull(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function DashboardCharts({
  data,
  showTeamAttendanceOverview = false
}: {
  data: DashboardChartPayload;
  showTeamAttendanceOverview?: boolean;
}) {
  const leadMixTotal = data.hotLeads + data.saleLeads;
  const hasMonthlySales = data.monthlySales.some((r) => r.amount > 0);
  const hasMonthlyNewLeads = data.monthlyNewLeads.some((r) => r.count > 0);
  const attendanceRate =
    data.totalUsers > 0 ? Math.round((data.activeToday / data.totalUsers) * 100) : 0;
  const attendanceIdle = Math.max(0, 100 - attendanceRate);

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => setIsDark(root.classList.contains("dark"));
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const axisColor = isDark ? "#9ecfc5" : "#3d5c56";
  const gridColor = isDark ? "rgba(31, 82, 73, 0.55)" : "rgba(212, 235, 230, 0.9)";
  const tooltipBg = isDark ? "rgba(15, 34, 31, 0.97)" : "rgba(255, 255, 255, 0.98)";
  const tooltipBorder = isDark
    ? "rgba(45, 155, 138, 0.35)"
    : "rgba(26, 122, 109, 0.18)";

  const doughnutData: ChartData<"doughnut"> = useMemo(
    () => ({
      labels: ["Hot leads", "Sales leads"],
      datasets: [
        {
          data: [data.hotLeads, data.saleLeads],
          backgroundColor: [BRAND.teal, BRAND.orange],
          borderColor: isDark ? "#163530" : "#ffffff",
          borderWidth: 3,
          hoverOffset: 6
        }
      ]
    }),
    [data.hotLeads, data.saleLeads, isDark]
  );

  const doughnutOptions: ChartOptions<"doughnut"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: isDark ? "#e2e8f0" : "#0f172a",
          bodyColor: isDark ? "#e2e8f0" : "#0f172a",
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx: TooltipItem<"doughnut">) => {
              const v = typeof ctx.parsed === "number" ? ctx.parsed : 0;
              return ` ${ctx.label}: ${v}`;
            }
          }
        }
      }
    }),
    [isDark, tooltipBg, tooltipBorder]
  );

  const barData: ChartData<"bar"> = useMemo(
    () => ({
      labels: data.monthlySales.map((r) => r.label),
      datasets: [
        {
          label: "Revenue",
          data: data.monthlySales.map((r) => r.amount),
          backgroundColor: data.monthlySales.map(
            (_, i) => BAR_COLORS[i % BAR_COLORS.length]
          ),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 42
        }
      ]
    }),
    [data.monthlySales]
  );

  const barOptions: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: isDark ? "#e2e8f0" : "#0f172a",
          bodyColor: isDark ? "#e2e8f0" : "#0f172a",
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: (items) => {
              const i = items[0]?.dataIndex ?? 0;
              return data.monthlySales[i]?.month ?? "";
            },
            label: (ctx: TooltipItem<"bar">) => {
              const v = typeof ctx.parsed.y === "number" ? ctx.parsed.y : 0;
              return ` Revenue: ${currencyFull(v)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: axisColor, font: { size: 11 } },
          border: { color: gridColor }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: axisColor,
            font: { size: 11 },
            callback: (value) => currencyShort(Number(value))
          },
          border: { display: false }
        }
      }
    }),
    [axisColor, data.monthlySales, gridColor, isDark, tooltipBg, tooltipBorder]
  );

  const lineData: ChartData<"line"> = useMemo(
    () => ({
      labels: data.monthlyNewLeads.map((r) => r.label),
      datasets: [
        {
          label: "New leads",
          data: data.monthlyNewLeads.map((r) => r.count),
          borderColor: BRAND.tealLight,
          backgroundColor: "rgba(26, 122, 109, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 3.5,
          pointHoverRadius: 5,
          pointBackgroundColor: BRAND.tealLight,
          borderWidth: 3
        }
      ]
    }),
    [data.monthlyNewLeads]
  );

  const lineOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: isDark ? "#e2e8f0" : "#0f172a",
          bodyColor: isDark ? "#e2e8f0" : "#0f172a",
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx: TooltipItem<"line">) => {
              const v = typeof ctx.parsed.y === "number" ? ctx.parsed.y : 0;
              return ` New leads: ${v}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: axisColor, font: { size: 11 } },
          border: { color: gridColor }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: axisColor,
            font: { size: 11 },
            precision: 0,
            stepSize: 1
          },
          grid: { color: gridColor },
          border: { display: false }
        }
      }
    }),
    [axisColor, gridColor, isDark, tooltipBg, tooltipBorder]
  );

  const attendanceData: ChartData<"doughnut"> = useMemo(
    () => ({
      labels: ["Active", "Other"],
      datasets: [
        {
          data: [attendanceRate, attendanceIdle],
          backgroundColor: [BRAND.tealLight, isDark ? "#1a443d" : "#d4ebe6"],
          borderWidth: 0,
          hoverOffset: 2
        }
      ]
    }),
    [attendanceIdle, attendanceRate, isDark]
  );

  const attendanceOptions: ChartOptions<"doughnut"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "78%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: isDark ? "#e2e8f0" : "#0f172a",
          bodyColor: isDark ? "#e2e8f0" : "#0f172a",
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (ctx: TooltipItem<"doughnut">) => {
              const v = typeof ctx.parsed === "number" ? ctx.parsed : 0;
              return ` ${ctx.label}: ${v}%`;
            }
          }
        }
      }
    }),
    [isDark, tooltipBg, tooltipBorder]
  );

  return (
    <section className="space-y-3 sm:space-y-4">
      <div>
        <h2 className="dash-title-lg">Performance analytics</h2>
        <p className="dash-subtitle mt-0.5">
          Lead distribution, revenue, and pipeline activity
          {showTeamAttendanceOverview ? " · staffing" : ""}
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="dash-card dash-card-pad surface-reveal">
          <div className="dash-card-header">
            <div>
              <h3 className="dash-title">Lead distribution</h3>
              <p className="dash-subtitle">Hot vs sales pipeline mix</p>
            </div>
            <div className="glass-chip !px-2 !py-0.5 text-[0.65rem] text-slate-600 dark:text-slate-300">
              Pipeline
            </div>
          </div>
          <div className="dash-chart-slot">
            {leadMixTotal === 0 ? (
              <div className="dash-empty">
                <LineChartIcon className="mb-1 h-5 w-5 opacity-70" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No leads to chart yet
                </p>
                <p className="max-w-sm text-sm leading-relaxed">
                  Add hot or sales leads under Operations and this chart will show the mix.
                </p>
              </div>
            ) : (
              <>
                <Doughnut data={doughnutData} options={doughnutOptions} />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full border border-slate-200/80 bg-[var(--mix-surface)]/90 px-5 py-3 text-center shadow-sm dark:border-slate-700">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Total
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                      {leadMixTotal}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { name: "Hot leads", value: data.hotLeads, color: BRAND.teal },
              { name: "Sales leads", value: data.saleLeads, color: BRAND.orange }
            ].map((item) => (
              <div key={item.name} className="dash-metric">
                <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </div>
                <div className="dash-metric-value text-2xl">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-card dash-card-pad surface-reveal">
          <div className="dash-card-header">
            <div>
              <h3 className="dash-title">Revenue overview</h3>
              <p className="dash-subtitle">Last 6 months booked sales</p>
            </div>
            <div className="glass-chip !px-2 !py-0.5 text-[0.65rem] text-slate-600 dark:text-slate-300">
              Revenue
            </div>
          </div>
          <div className="dash-metric mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="dash-metric-label">Booked total</div>
              <div className="dash-metric-value text-lg">
                {currencyFull(data.totalSalesAmount)}
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">6-mo</div>
          </div>
          <div className="dash-chart-slot dash-chart-slot--tall">
            {!hasMonthlySales ? (
              <div className="dash-empty">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No revenue in this window
                </p>
                <p className="max-w-sm text-sm leading-relaxed">
                  Sale leads with amounts in the last six months appear here.
                </p>
              </div>
            ) : (
              <Bar data={barData} options={barOptions} />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <div className="dash-card dash-card-pad surface-reveal">
          <div className="dash-card-header">
            <div>
              <h3 className="dash-title">Pipeline activity</h3>
              <p className="dash-subtitle">New leads by month</p>
            </div>
            <div className="glass-chip !px-2 !py-0.5 text-[0.65rem] text-slate-600 dark:text-slate-300">
              Trend
            </div>
          </div>
          <div className="dash-chart-slot dash-chart-slot--tall">
            {!hasMonthlyNewLeads ? (
              <div className="dash-empty">
                <LineChartIcon className="mb-1 h-5 w-5 opacity-70" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No new leads this period
                </p>
                <p className="max-w-sm text-sm leading-relaxed">
                  When leads are created, monthly counts will show here.
                </p>
              </div>
            ) : (
              <Line data={lineData} options={lineOptions} />
            )}
          </div>
        </div>

        {showTeamAttendanceOverview ? (
          <div className="dash-card dash-card-pad surface-reveal flex flex-col justify-between">
            <div>
              <h3 className="dash-title">Team attendance today</h3>
              <p className="dash-subtitle mt-1">
                Share of users with an active open shift right now.
              </p>
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-4">
              <div className="relative h-44 w-44">
                <Doughnut data={attendanceData} options={attendanceOptions} />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {attendanceRate}%
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Active
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/75 dark:bg-slate-800/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--brand-teal-light)] to-[var(--brand-orange)]"
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>

              <div className="grid w-full gap-2 sm:grid-cols-2">
                <div className="dash-metric text-center">
                  <div className="dash-metric-label">Open shifts</div>
                  <div className="dash-metric-value text-2xl">{data.activeToday}</div>
                </div>
                <div className="dash-metric text-center">
                  <div className="dash-metric-label">Total users</div>
                  <div className="dash-metric-value text-2xl">{data.totalUsers}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="dash-card dash-card-pad surface-reveal flex flex-col justify-center gap-4 text-center">
            <div>
              <h3 className="dash-title">Attendance</h3>
              <p className="dash-subtitle mt-2">
                Organization-wide attendance is limited to administrator accounts.
              </p>
            </div>
            <Link
              href="/attendance"
              className="mx-auto inline-flex rounded-xl border border-slate-200 bg-[var(--mix-surface)] px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-600"
            >
              Open my attendance
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
