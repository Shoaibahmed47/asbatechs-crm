"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TablePaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
  className?: string;
};

export function TablePagination({
  page,
  totalPages,
  total,
  limit,
  loading = false,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 25, 50],
  className
}: TablePaginationProps) {
  const safeTotalPages = Math.max(totalPages, 0);
  const hasRows = total > 0;
  const canPrev = hasRows && page > 1;
  const canNext = hasRows && safeTotalPages > 0 && page < safeTotalPages;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-slate-200/80 pt-4 dark:border-slate-700/80 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {hasRows ? (
          <>
            Showing{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {(page - 1) * limit + 1}
            </span>
            –
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {Math.min(page * limit, total)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">{total}</span>
          </>
        ) : (
          "No rows match the current filters."
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onLimitChange ? (
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            Rows
            <select
              className="form-input h-9 py-1 text-xs"
              value={limit}
              disabled={loading}
              onChange={(e) => onLimitChange(Number(e.target.value))}
            >
              {limitOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2"
            disabled={loading || !canPrev}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-slate-700 dark:text-slate-300">
            {hasRows && safeTotalPages > 0 ? (
              <>
                {page} / {safeTotalPages}
              </>
            ) : (
              "—"
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-2"
            disabled={loading || !canNext}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
