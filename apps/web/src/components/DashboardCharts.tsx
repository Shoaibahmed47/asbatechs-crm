"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";

export type DashboardChartPayload = {
  hotLeads: number;
  saleLeads: number;
  totalSalesAmount: number;
  activeToday: number;
  totalUsers: number;
  monthlySales: { month: string; label: string; amount: number }[];
  monthlyNewLeads: { month: string; label: string; count: number }[];
};

const PIE_COLORS = ["#0f4c45", "#e86a17"];
const BAR_COLORS = ["#0f4c45", "#1a7a6d", "#2d9b8a", "#e86a17", "#c9a227", "#2a8f7e"];

const CHART_AREA = {
  pie: { width: 560, height: 280 },
  bar: { width: 560, height: 340 },
  line: { width: 560, height: 320 }
} as const;

function currencyShort(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function DashboardCharts({
  data,
  showTeamAttendanceOverview = false
}: {
  data: DashboardChartPayload;
  showTeamAttendanceOverview?: boolean;
}) {
  const leadMix = [
    { name: "Hot leads", value: data.hotLeads },
    { name: "Sales leads", value: data.saleLeads }
  ];

  const leadMixTotal = data.hotLeads + data.saleLeads;
  const hasMonthlySales = data.monthlySales.some((r) => r.amount > 0);
  const hasMonthlyNewLeads = data.monthlyNewLeads.some((r) => r.count > 0);
  const attendanceRate =
    data.totalUsers > 0 ? Math.round((data.activeToday / data.totalUsers) * 100) : 0;
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => setIsDark(root.classList.contains("dark"));
    applyTheme();

    const observer = new MutationObserver(applyTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const chartAxis = useMemo(
    () => ({ fill: isDark ? "#9ecfc5" : "#3d5c56", fontSize: 11 }),
    [isDark]
  );
  const gridStroke = isDark ? "#1f5249" : "#d4ebe6";
  const tooltipStyle = useMemo(
    () => ({
      borderRadius: 14,
      border: isDark
        ? "1px solid color-mix(in srgb, #2d9b8a 35%, transparent)"
        : "1px solid color-mix(in srgb, #1a7a6d 18%, transparent)",
      background: isDark ? "rgba(15, 34, 31, 0.97)" : "rgba(255, 255, 255, 0.98)",
      color: isDark ? "#e2e8f0" : "#0f172a",
      boxShadow: isDark
        ? "0 20px 38px rgba(2, 20, 18, 0.52)"
        : "0 18px 36px rgba(15, 76, 69, 0.12)",
      fontSize: 12
    }),
    [isDark]
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
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  initialDimension={CHART_AREA.pie}
                >
                  <PieChart>
                    <Pie
                      data={leadMix}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={98}
                      paddingAngle={3}
                    >
                      {leadMix.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        typeof value === "number" ? value : Number(value),
                        "Leads"
                      ]}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
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
            {leadMix.map((item, index) => (
              <div key={item.name} className="dash-metric">
                <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[index] }}
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
                {data.totalSalesAmount.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD"
                })}
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
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                initialDimension={CHART_AREA.bar}
              >
                <BarChart data={data.monthlySales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={chartAxis}
                    tickLine={false}
                    axisLine={{ stroke: gridStroke }}
                  />
                  <YAxis
                    tickFormatter={currencyShort}
                    tick={chartAxis}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value) => {
                      const n = typeof value === "number" ? value : Number(value);
                      return Number.isFinite(n)
                        ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
                        : String(value ?? "");
                    }}
                    labelFormatter={(_, payload) => String(payload?.[0]?.payload?.month ?? "")}
                    contentStyle={tooltipStyle}
                  />
                  <Bar dataKey="amount" name="Revenue" fill="#1a7a6d" radius={[6, 6, 0, 0]}>
                    {data.monthlySales.map((row, index) => (
                      <Cell key={row.month} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                initialDimension={CHART_AREA.line}
              >
                <LineChart
                  data={data.monthlyNewLeads}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={chartAxis}
                    tickLine={false}
                    axisLine={{ stroke: gridStroke }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={chartAxis}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip
                    formatter={(value) => [
                      typeof value === "number" ? value : Number(value),
                      "New leads"
                    ]}
                    contentStyle={tooltipStyle}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="New leads"
                    stroke="#1a7a6d"
                    strokeWidth={3}
                    dot={{ r: 3.5, fill: "#1a7a6d" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
              <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-[12px] border-[color-mix(in_srgb,var(--teal-100)_80%,transparent)] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--mix-surface)_96%,transparent),color-mix(in_srgb,var(--teal-60)_55%,transparent))] dark:border-[color-mix(in_srgb,var(--teal-100)_70%,transparent)]">
                <div className="text-center">
                  <div className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
                    {attendanceRate}%
                  </div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Active
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
