"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

const PIE_COLORS = ["#2563eb", "#059669"];
const CHART_AXIS = { fill: "#64748b", fontSize: 11 };
const GRID_STROKE = "#e2e8f0";

function currencyShort(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function DashboardCharts({ data }: { data: DashboardChartPayload }) {
  const leadMix = [
    { name: "Hot leads", value: data.hotLeads },
    { name: "Sales leads", value: data.saleLeads }
  ];

  const attendanceRate =
    data.totalUsers > 0
      ? Math.round((data.activeToday / data.totalUsers) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Charts</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Lead mix, revenue trend, pipeline activity, and team attendance
          snapshot.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lead mix
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Hot vs sales records in <code className="text-[10px]">leads</code>
          </p>
          <div className="mt-2 h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadMix}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {leadMix.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    typeof value === "number" ? value : Number(value),
                    "Leads"
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sales performance
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Recorded sale amounts by month (last 6 months)
          </p>
          <div className="mt-2 h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.monthlySales}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
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
                  axisLine={{ stroke: GRID_STROKE }}
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
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.month ?? "")
                  }
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12
                  }}
                />
                <Bar
                  dataKey="amount"
                  name="Revenue"
                  fill="#0f172a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pipeline activity
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            New lead rows created per month (all types)
          </p>
          <div className="mt-2 h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.monthlyNewLeads}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
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
                  axisLine={{ stroke: GRID_STROKE }}
                  width={36}
                />
                <Tooltip
                  formatter={(value) => [
                    typeof value === "number" ? value : Number(value),
                    "New leads"
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="New leads"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#2563eb" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Team attendance today
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Share of users with an open shift (clocked in, not out)
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2">
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-8 border-slate-100 bg-slate-50">
              <div className="text-center">
                <div className="text-3xl font-semibold text-slate-900">
                  {attendanceRate}%
                </div>
                <div className="text-[10px] uppercase text-slate-500">
                  active
                </div>
              </div>
            </div>
            <p className="max-w-xs text-center text-xs text-slate-600">
              <span className="font-semibold text-slate-800">
                {data.activeToday}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-800">
                {data.totalUsers}
              </span>{" "}
              users currently in an open shift.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
