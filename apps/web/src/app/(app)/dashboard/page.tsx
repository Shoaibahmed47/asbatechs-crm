import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { count, sum } from "drizzle-orm";

export default async function DashboardPage() {
  const [hotCount] = await db
    .select({ value: count() })
    .from(schema.hotLeads);
  const [saleCount] = await db
    .select({ value: count() })
    .from(schema.saleLeads);
  const [totalSales] = await db
    .select({ value: sum(schema.saleLeads.saleAmount) })
    .from(schema.saleLeads);

  const totalLeads = Number(hotCount?.value ?? 0) + Number(saleCount?.value ?? 0);
  const totalSalesAmount = Number(totalSales?.value ?? 0);

  const today = new Date().toISOString().slice(0, 10);
  const todaysLogs = await db
    .select()
    .from(schema.attendanceLogs)
    .where(schema.attendanceLogs.date.eq(today as any) as any);
  const activeToday = todaysLogs.filter((l) => l.clockIn && !l.clockOut).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          CRM Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          High-level overview of leads, sales, and attendance across departments.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase text-slate-500">
            Total leads
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {totalLeads}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Combined hot and sales leads in the system.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
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
            Sum of closed sales across all departments.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase text-slate-500">
            Active today
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {activeToday}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Employees currently clocked in and working.
          </p>
        </div>
      </div>
    </div>
  );
}

