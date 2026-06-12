import type { PersonAttendanceStatus } from "@/lib/attendance-status-today";
import { formatAttendanceClock } from "@/lib/attendance-date";
import { countAttendanceByStatus } from "@/lib/attendance-status-today";

function StatusPill({ status }: { status: PersonAttendanceStatus["status"] }) {
  const styles =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
      : status === "idle"
        ? "bg-rose-500/15 text-rose-900 dark:text-rose-300"
      : status === "break"
        ? "bg-amber-500/15 text-amber-900 dark:text-amber-300"
        : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-400";

  const label =
    status === "active"
      ? "Active"
      : status === "idle"
        ? "Inactive"
        : status === "break"
          ? "On break"
          : "Offline";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold uppercase tracking-wide ${styles}`}>
      {label}
    </span>
  );
}

export function AdminAttendanceLivePanel({
  people,
  date
}: {
  people: PersonAttendanceStatus[];
  date: string;
}) {
  const c = countAttendanceByStatus(people);

  return (
    <section className="app-panel rounded-[28px] px-6 py-7 sm:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="glass-chip inline-flex text-sky-700 dark:text-sky-200">Team presence</div>
          <h2 className="mt-3 font-[var(--font-display)] text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Live attendance - {date}
          </h2>
          <p className="mt-1 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Who is working, on break, inactive, or offline right now. Break start and end show the
            <span className="font-medium text-slate-700 dark:text-slate-300"> current break </span>
            if one is open, otherwise the
            <span className="font-medium text-slate-700 dark:text-slate-300"> most recent completed break </span>
            today.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 px-4 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <div className="text-sm font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">Active</div>
            <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{c.active}</div>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 px-4 py-2 dark:border-amber-900/40 dark:bg-amber-950/30">
            <div className="text-sm font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-400">
              On break
            </div>
            <div className="text-lg font-semibold text-amber-800 dark:text-amber-300">{c.onBreak}</div>
          </div>
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 px-4 py-2 dark:border-rose-900/40 dark:bg-rose-950/30">
            <div className="text-sm font-semibold uppercase tracking-wider text-rose-900 dark:text-rose-400">
              Inactive
            </div>
            <div className="text-lg font-semibold text-rose-800 dark:text-rose-300">{c.idle}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 px-4 py-2 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Offline</div>
            <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">{c.offline}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 max-h-[min(22rem,45vh)] overflow-auto rounded-2xl border border-slate-200/90 dark:border-slate-800">
        <table className="w-full min-w-[44rem] text-left text-sm md:min-w-[52rem]">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="hidden px-4 py-3 sm:table-cell">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Clock in</th>
              <th className="px-4 py-3">Clock out</th>
              <th className="px-4 py-3">Break start</th>
              <th className="px-4 py-3">Break end</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {people.map((p) => (
              <tr key={p.userId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{p.name}</td>
                <td className="hidden px-4 py-2.5 text-slate-600 dark:text-slate-400 sm:table-cell">{p.email}</td>
                <td className="px-4 py-2.5">
                  <StatusPill status={p.status} />
                </td>
                <td className="max-w-[22rem] px-4 py-2.5 text-slate-700 dark:text-slate-300">
                  {p.statusReason}
                </td>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{formatAttendanceClock(p.clockIn)}</td>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{formatAttendanceClock(p.clockOut)}</td>
                <td
                  className="px-4 py-2.5 text-slate-700 dark:text-slate-300"
                  title={p.breakIsOpen ? "Current break (in progress)" : "Last completed break start"}
                >
                  {formatAttendanceClock(p.breakStart)}
                </td>
                <td
                  className="px-4 py-2.5 text-slate-700 dark:text-slate-300"
                  title={
                    p.breakIsOpen
                      ? "Break still open - end time appears after employee ends break"
                      : p.breakEnd
                        ? "Last completed break end"
                        : undefined
                  }
                >
                  {p.breakIsOpen ? <span className="text-amber-700 dark:text-amber-400">- (open)</span> : formatAttendanceClock(p.breakEnd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
