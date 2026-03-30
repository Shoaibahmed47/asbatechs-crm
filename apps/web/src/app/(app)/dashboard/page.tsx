import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getLocalDateString } from "@/lib/attendance-date";
import { DashboardCharts } from "@/components/DashboardCharts";
import {
  and,
  count,
  eq,
  gte,
  isNotNull,
  sql,
  sum
} from "drizzle-orm";

function monthKeysLast(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return out;
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "numeric"
  });
}

function startOfRollingMonthsAgo(monthsBackFromStart: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBackFromStart);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  const [hotCount] = await db
    .select({ value: count() })
    .from(schema.leads)
    .where(and(eq(schema.leads.type, "hot"), eq(schema.leads.isDeleted, false)));
  const [saleCount] = await db
    .select({ value: count() })
    .from(schema.leads)
    .where(and(eq(schema.leads.type, "sale"), eq(schema.leads.isDeleted, false)));
  const [totalSales] = await db
    .select({ value: sum(schema.leads.saleAmount) })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.type, "sale"),
        isNotNull(schema.leads.saleAmount),
        eq(schema.leads.isDeleted, false)
      )
    );

  const [userCount] = await db
    .select({ value: count() })
    .from(schema.users);

  const totalLeads = Number(hotCount?.value ?? 0) + Number(saleCount?.value ?? 0);
  const totalSalesAmount = Number(totalSales?.value ?? 0);
  const totalUsers = Number(userCount?.value ?? 0);

  const today = getLocalDateString();
  const todaysLogs = await db
    .select()
    .from(schema.attendanceLogs)
    .where(eq(schema.attendanceLogs.date, today));
  const activeToday = todaysLogs.filter((l) => l.clockIn && !l.clockOut).length;

  const months = monthKeysLast(6);
  const saleFrom = startOfRollingMonthsAgo(5);

  const saleMonthExpr = sql<string>`to_char(${schema.leads.saleDate}, 'YYYY-MM')`;
  const monthlySalesRows = await db
    .select({
      month: saleMonthExpr,
      total: sum(schema.leads.saleAmount)
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.type, "sale"),
        isNotNull(schema.leads.saleDate),
        eq(schema.leads.isDeleted, false),
        gte(schema.leads.saleDate, saleFrom.toISOString().slice(0, 10) as any)
      )
    )
    .groupBy(saleMonthExpr)
    .orderBy(saleMonthExpr);

  const salesByMonth = new Map(
    monthlySalesRows.map((r) => [
      r.month,
      Number(r.total ?? 0)
    ])
  );
  const monthlySales = months.map((m) => ({
    month: m,
    label: formatMonthLabel(m),
    amount: salesByMonth.get(m) ?? 0
  }));

  const leadCreatedFrom = startOfRollingMonthsAgo(5);
  const createdMonthExpr = sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM')`;
  const monthlyNewRows = await db
    .select({
      month: createdMonthExpr,
      c: count()
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.isDeleted, false), gte(schema.leads.createdAt, leadCreatedFrom)))
    .groupBy(createdMonthExpr)
    .orderBy(createdMonthExpr);

  const newByMonth = new Map(
    monthlyNewRows.map((r) => [r.month, Number(r.c ?? 0)])
  );
  const monthlyNewLeads = months.map((m) => ({
    month: m,
    label: formatMonthLabel(m),
    count: newByMonth.get(m) ?? 0
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          CRM Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Leads, sales, performance, and attendance at a glance — with live
          charts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">
            Total leads
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {totalLeads}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Hot + sales rows in <code className="text-[10px]">leads</code>.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">
            Hot leads
          </div>
          <div className="mt-2 text-2xl font-semibold text-blue-700">
            {Number(hotCount?.value ?? 0)}
          </div>
          <p className="mt-1 text-xs text-slate-500">Pipeline / follow-up.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">
            Total sales
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {totalSalesAmount.toLocaleString(undefined, {
              style: "currency",
              currency: "USD"
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Sum of recorded sale amounts.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">
            Active today
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-700">
            {activeToday}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Open shifts right now ({totalUsers} users in CRM).
          </p>
        </div>
      </div>

      <DashboardCharts
        data={{
          hotLeads: Number(hotCount?.value ?? 0),
          saleLeads: Number(saleCount?.value ?? 0),
          totalSalesAmount,
          activeToday,
          totalUsers,
          monthlySales,
          monthlyNewLeads
        }}
      />
    </div>
  );
}
