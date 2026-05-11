const MAX_TAGS = 30;
const MAX_TAG_LEN = 120;

/**
 * Parse DB value: JSON string array from the tag UI, or legacy plain text as a single tag.
 */
export function parseServicePurchasedToTags(value: string | null | undefined): string[] {
  if (value == null) return [];
  const s = value.trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, MAX_TAGS)
        .map((x) => (x.length > MAX_TAG_LEN ? x.slice(0, MAX_TAG_LEN) : x));
    }
  } catch {
    // not JSON — treat as legacy single line
  }
  const single = s.length > MAX_TAG_LEN ? s.slice(0, MAX_TAG_LEN) : s;
  return [single];
}

/**
 * Persist tags: JSON array (including one element) so parsing stays consistent.
 */
export function serializeServicePurchasedTags(tags: string[]): string | undefined {
  const cleaned = tags
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS)
    .map((t) => (t.length > MAX_TAG_LEN ? t.slice(0, MAX_TAG_LEN) : t));
  if (cleaned.length === 0) return undefined;
  return JSON.stringify(cleaned);
}
