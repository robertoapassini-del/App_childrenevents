import {
  parseWeeklyHours,
  WEEKDAYS,
  type ActivityKind,
  type Weekday,
  type WeeklyHours,
} from "./enums";

/**
 * Everything on the map — a one-off event, a weekly ludothèque, a playground that
 * is simply always there — resolves through this module into the same shape: a
 * list of concrete time windows. That's what lets the map, the filters and the
 * "what's on today" question have exactly one code path instead of three.
 */

export const TIMEZONE = "Europe/Zurich";

/** An event with no stated end is assumed to run this long. */
export const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

/** Guard against a caller asking for occurrences across a decade. */
const MAX_WINDOW_DAYS = 120;

export interface Occurrence {
  start: Date;
  end: Date;
}

export interface SchedulableActivity {
  kind: ActivityKind;
  startsAt: Date | null;
  endsAt: Date | null;
  weeklyHours: string | null;
  alwaysOpen: boolean;
}

// --- Timezone helpers ---------------------------------------------------------
//
// Switzerland changes offset twice a year, and "every Wednesday at 14:00" means
// 14:00 in Lausanne on both sides of that change — so wall-clock times have to be
// resolved through the zone rather than by adding a fixed offset to UTC.

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
}

const WEEKDAY_BY_SHORT: Record<string, Weekday> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hour12: false,
});

export function zonedParts(date: Date): ZonedParts {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // Intl renders midnight as "24" in some ICU versions under hour12: false.
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAY_BY_SHORT[get("weekday")] ?? "mon",
  };
}

/** How far the zone is ahead of UTC at this instant, in milliseconds. */
function zoneOffsetMs(date: Date): number {
  const p = zonedParts(date);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUtc - date.getTime();
}

/** Build the instant at which the zone's wall clock reads the given local time. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  // First guess uses the offset in force at the naive instant; a second pass
  // settles the cases where the guess landed on the far side of a DST switch.
  const firstOffset = zoneOffsetMs(new Date(naive));
  const candidate = new Date(naive - firstOffset);
  const secondOffset = zoneOffsetMs(candidate);
  return secondOffset === firstOffset
    ? candidate
    : new Date(naive - secondOffset);
}

/** Midnight, local time, on the day containing `date`. */
export function startOfZonedDay(date: Date): Date {
  const p = zonedParts(date);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0);
}

export function endOfZonedDay(date: Date): Date {
  return new Date(startOfZonedDay(date).getTime() + 24 * 60 * 60 * 1000);
}

/** The upcoming Saturday 00:00 → Monday 00:00, or the current one if it's underway. */
export function weekendWindow(now: Date): Occurrence {
  const todayStart = startOfZonedDay(now);
  const weekday = zonedParts(now).weekday;
  const index = WEEKDAYS.indexOf(weekday); // 0 = Monday

  // Saturday and Sunday count as "this weekend, now"; otherwise look forward.
  const daysUntilSaturday = index >= 5 ? -(index - 5) : 5 - index;
  const start = new Date(
    todayStart.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000,
  );
  const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
  return { start, end };
}

// --- Occurrences --------------------------------------------------------------

function minutesOf(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

function weeklyOccurrences(
  hours: WeeklyHours,
  from: Date,
  to: Date,
): Occurrence[] {
  const out: Occurrence[] = [];
  let cursor = startOfZonedDay(from);
  let guard = 0;

  while (cursor < to && guard < MAX_WINDOW_DAYS) {
    guard += 1;
    const p = zonedParts(cursor);
    const ranges = hours[p.weekday] ?? [];

    for (const range of ranges) {
      const s = minutesOf(range.start);
      const e = minutesOf(range.end);
      const start = zonedTimeToUtc(p.year, p.month, p.day, s.hour, s.minute);
      const end = zonedTimeToUtc(p.year, p.month, p.day, e.hour, e.minute);
      // Keep anything that overlaps the window, not just what starts inside it —
      // an activity already underway is exactly what a parent is looking for.
      if (end > from && start < to) out.push({ start, end });
    }

    // Step via midday to avoid landing on a DST-skipped hour.
    cursor = startOfZonedDay(
      new Date(cursor.getTime() + 36 * 60 * 60 * 1000),
    );
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Every time window for this activity that overlaps [from, to).
 *
 * EVENT resolves from its stored dates; RECURRING and PLACE resolve from their
 * weekly hours; an always-open place fills the window. A caller can therefore
 * sort a playground and a Tuesday storytime in the same list.
 */
export function nextOccurrences(
  activity: SchedulableActivity,
  from: Date,
  to: Date,
): Occurrence[] {
  if (to <= from) return [];

  if (activity.kind === "EVENT") {
    if (!activity.startsAt) return [];
    const start = activity.startsAt;
    const end =
      activity.endsAt ?? new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
    return end > from && start < to ? [{ start, end }] : [];
  }

  if (activity.alwaysOpen) return [{ start: from, end: to }];

  const hours = parseWeeklyHours(activity.weeklyHours);
  if (!hours) return [];
  return weeklyOccurrences(hours, from, to);
}

/** Is this activity available right now? */
export function isOpenNow(activity: SchedulableActivity, now: Date): boolean {
  if (activity.alwaysOpen) return true;
  // A one-hour probe is enough to catch a window containing `now`.
  const occurrences = nextOccurrences(
    activity,
    new Date(now.getTime() - 60 * 60 * 1000),
    new Date(now.getTime() + 60 * 60 * 1000),
  );
  return occurrences.some((o) => o.start <= now && o.end > now);
}

/** The next window starting at or after `now`, or the one already underway. */
export function nextOccurrenceFrom(
  activity: SchedulableActivity,
  now: Date,
  horizonDays = 14,
): Occurrence | null {
  const to = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const [first] = nextOccurrences(activity, now, to);
  return first ?? null;
}

/** Does anything happen inside this window? Drives the today/weekend filters. */
export function occursWithin(
  activity: SchedulableActivity,
  window: Occurrence,
): boolean {
  return nextOccurrences(activity, window.start, window.end).length > 0;
}
