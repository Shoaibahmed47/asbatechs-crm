"use client";

import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { parseServicePurchasedToTags } from "@/lib/service-purchased-tags";
import { cn } from "@/lib/utils";

const MAX_TAGS = 30;
const MAX_TAG_LEN = 120;

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
  hasError?: boolean;
};

export function ServicePurchasedTagsInput({ tags, onChange, hasError }: Props) {
  const [draft, setDraft] = useState("");

  const addDraft = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    const piece = t.length > MAX_TAG_LEN ? t.slice(0, MAX_TAG_LEN) : t;
    if (tags.length >= MAX_TAGS) {
      setDraft("");
      return;
    }
    const lower = piece.toLowerCase();
    if (tags.some((x) => x.toLowerCase() === lower)) {
      setDraft("");
      return;
    }
    onChange([...tags, piece]);
    setDraft("");
  }, [draft, tags, onChange]);

  const removeAt = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div
      className={cn(
        "form-input mt-1 flex min-h-[42px] flex-wrap items-center gap-1.5 py-1.5 pl-2 pr-1",
        hasError && "border-red-300 ring-1 ring-red-200 dark:border-red-700 dark:ring-red-900/40"
      )}
    >
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-slate-900 py-1 pl-2.5 pr-1 text-xs font-medium text-white dark:bg-black"
        >
          <span className="truncate" title={tag}>
            {tag}
          </span>
          <button
            type="button"
            className="inline-flex shrink-0 rounded p-0.5 text-white/90 transition hover:bg-white/20 hover:text-white"
            aria-label={`Remove ${tag}`}
            onClick={() => removeAt(index)}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        type="text"
        className="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={tags.length === 0 ? "Type a service, press Enter" : "Add another…"}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addDraft();
          } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
            e.preventDefault();
            onChange(tags.slice(0, -1));
          }
        }}
        disabled={tags.length >= MAX_TAGS}
      />
    </div>
  );
}

/** Read-only chips for tables (parses JSON or legacy plain text). */
export function ServicePurchasedTagsDisplay({ value }: { value: string | null }) {
  const tags = parseServicePurchasedToTags(value ?? undefined);
  if (tags.length === 0) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <div className="flex max-w-[220px] flex-wrap gap-1">
      {tags.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="inline-block max-w-[200px] truncate rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-black"
          title={t}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
