"use client";

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

export type DashboardChartPayload = {
  hotLeads: number;
  saleLeads: number;
  totalSalesAmount: number;
  activeToday: number;
  totalUsers: number;
  monthlySales: { month: string; label: string; amount: number }[];
  monthlyNewLeads: { month: string; label: string; count: number }[];
};

const PIE_COLORS = ["#2563eb", "#0f766e"];
const CHART_AXIS = { fill: "#64748b", fontSize: 11 };
const GRID_STROKE = "#dbe4f0";

/** Recharts 3 defaults initial size to -1×-1; that logs a warning until ResizeObserver runs. */
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

const tooltipStyle = {
  borderRadius: 14,
  border: "1px solid rgba(148, 163, 184, 0.24)",
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 18px 36px rgba(15, 23, 42, 0.12)",
  fontSize: 12
};

export function DashboardCharts({ data }: { data: DashboardChartPayload }) {
  const leadMix = [
    { name: "Hot leads", value: data.hotLeads },
    { name: "Sales leads", value: data.saleLeads }
  ];

  const attendanceRate =
    data.totalUsers > 0 ? Math.round((data.activeToday / data.totalUsers) * 100) : 0;

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          Performance analytics
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Revenue, pipeline activity, and staffing visibility presented in a clearer executive format.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="data-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Lead mix
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Relative split between active hot and sales lead records.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              Pipeline
            </div>
          </div>
          <div className="relative mt-4 h-[280px] w-full min-w-0">
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
                  innerRadius={66}
                  outerRadius={98}
                  paddingAngle={3}
                >
                  {leadMix.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[leadMix.indexOf(entry)]} />
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
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {leadMix.map((item, index) => (
              <div
                key={item.name}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[index] }}
                  />
                  {item.name}
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="data-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Sales performance
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Monthly booked revenue for the last six months.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              Revenue
            </div>
          </div>
          <div className="relative mt-4 h-[340px] w-full min-w-0">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={CHART_AREA.bar}
            >
              <BarChart data={data.monthlySales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={CHART_AXIS}
                  tickLine={false}
                  axisLine={{ stroke: GRID_STROKE }}
                />
                <YAxis
                  tickFormatter={currencyShort}
                  tick={CHART_AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : Number(value);
                    return Number.isFinite(n)
                      ? n.toLocaleString(undefined, {
                          style: "currency",
                          currency: "USD"
                        })
                      : String(value ?? "");
                  }}
                  labelFormatter={(_, payload) => String(payload?.[0]?.payload?.month ?? "")}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="amount" name="Revenue" fill="#0f172a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="data-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Pipeline activity
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Newly created lead records month over month.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              Trend
            </div>
          </div>
          <div className="relative mt-4 h-[320px] w-full min-w-0">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={CHART_AREA.line}
            >
              <LineChart data={data.monthlyNewLeads} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={CHART_AXIS}
                  tickLine={false}
                  axisLine={{ stroke: GRID_STROKE }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={CHART_AXIS}
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
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 3.5, fill: "#2563eb" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="data-card flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Team attendance today
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Share of users with an active open shift right now.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-5">
            <div className="relative flex h-52 w-52 items-center justify-center rounded-full border-[14px] border-slate-100 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(241,245,249,0.94))] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top,rgba(30,41,59,0.85),rgba(15,23,42,0.95))]">
              <div className="text-center">
                <div className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {attendanceRate}%
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                  Active
                </div>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-center dark:border-slate-800 dark:bg-slate-900/70">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Open shifts
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                  {data.activeToday}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-center dark:border-slate-800 dark:bg-slate-900/70">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Total users
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                  {data.totalUsers}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
