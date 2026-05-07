"use client";

import { toast } from "sonner";

type CopyReportLinkButtonProps = {
  queryParams: Record<string, string>;
};

export function CopyReportLinkButton({ queryParams }: CopyReportLinkButtonProps) {
  async function onCopyLink() {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value.trim().length > 0) params.set(key, value.trim());
    }
    const reportPath = `/attendance/report?${params.toString()}`;

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${reportPath}`);
      toast.success("Report link copied");
    } catch {
      toast.error("Failed to copy report link");
    }
  }

  return (
    <button
      type="button"
      onClick={onCopyLink}
      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600"
    >
      Copy report link
    </button>
  );
}
