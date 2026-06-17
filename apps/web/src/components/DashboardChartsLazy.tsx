"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function ChartsFallback() {
  return (
    <section className="space-y-5">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="mt-1 h-4 w-full max-w-md" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[320px] rounded-2xl" />
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
    </section>
  );
}

export const DashboardChartsLazy = dynamic(
  () => import("./DashboardCharts").then((mod) => mod.DashboardCharts),
  { loading: () => <ChartsFallback />, ssr: false }
);
