"use client";

import dynamic from "next/dynamic";

export const AttendanceReportTablesLazy = dynamic(
  () => import("./AttendanceReportTables").then((mod) => mod.AttendanceReportTables),
  {
    loading: () => (
      <div className="data-card px-4 py-8 text-center text-sm text-slate-500">
        Loading attendance monitor...
      </div>
    )
  }
);
