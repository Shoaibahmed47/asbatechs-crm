const DATE_TIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TZ_OFFSET_RE = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/;

function getOffsetMinutes(timeZone: string, instant: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
    hour12: false
  });
  const parts = formatter.formatToParts(instant);
  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value;
  if (!offsetPart) {
    throw new Error("Could not resolve timezone offset.");
  }
  const match = offsetPart.match(TZ_OFFSET_RE);
  if (!match) {
    return 0;
  }
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] ?? "0");
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function parseLocalDateTime(localDateTime: string) {
  const [datePart, timePart] = localDateTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return { year, month, day, hour, minute };
}

export function isValidTimeZone(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function buildFollowUpUtcIso(input: {
  localDateTime: string;
  timeZone: string;
}): string {
  const { localDateTime, timeZone } = input;
  if (!DATE_TIME_LOCAL_RE.test(localDateTime)) {
    throw new Error("Invalid follow-up date/time format.");
  }
  if (!isValidTimeZone(timeZone)) {
    throw new Error("Invalid timezone value.");
  }

  const { year, month, day, hour, minute } = parseLocalDateTime(localDateTime);
  const naiveUtcMillis = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  // First pass offset, then refine once for DST edge transitions.
  const firstOffsetMinutes = getOffsetMinutes(timeZone, new Date(naiveUtcMillis));
  const firstUtcMillis = naiveUtcMillis - firstOffsetMinutes * 60_000;
  const refinedOffsetMinutes = getOffsetMinutes(timeZone, new Date(firstUtcMillis));
  const refinedUtcMillis = naiveUtcMillis - refinedOffsetMinutes * 60_000;

  return new Date(refinedUtcMillis).toISOString();
}

export function isoToDateOnly(isoValue: string): string {
  return new Date(isoValue).toISOString().slice(0, 10);
}

export function isDateOnly(value: string | null | undefined): value is string {
  return !!value && DATE_ONLY_RE.test(value);
}
