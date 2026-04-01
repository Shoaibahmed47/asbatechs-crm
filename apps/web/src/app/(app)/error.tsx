"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        Error
      </p>
      <h1 className="mt-3 text-xl font-semibold text-slate-900 dark:text-slate-100">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        This view hit an unexpected error. Try again, or return to the dashboard.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Executive dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
