import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="app-panel rounded-[28px] px-6 py-7 sm:px-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-9 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-5">
        <div>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-[320px] rounded-2xl" />
          <Skeleton className="h-[320px] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
