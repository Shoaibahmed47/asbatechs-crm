export const BREAK_CATEGORIES = [
  "lunch",
  "prayer",
  "tea_coffee",
  "personal",
  "other"
] as const;

export type BreakCategory = (typeof BREAK_CATEGORIES)[number];

export const BREAK_CATEGORY_LABELS: Record<BreakCategory, string> = {
  lunch: "Lunch",
  prayer: "Prayer",
  tea_coffee: "Tea / coffee",
  personal: "Personal",
  other: "Other"
};

export function isBreakCategory(value: string): value is BreakCategory {
  return (BREAK_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeBreakCategory(value: unknown): BreakCategory | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isBreakCategory(normalized) ? normalized : null;
}

export function formatBreakCategoryLabel(category: string | null | undefined): string {
  if (!category) return "Break";
  const normalized = normalizeBreakCategory(category);
  return normalized ? BREAK_CATEGORY_LABELS[normalized] : category;
}

export function formatBreakDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
