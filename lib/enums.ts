import { z } from "zod";

// SQLite has no enum type, so every enum-ish column in schema.prisma is a String.
// These zod enums are the single source of truth for what may go in them: the API
// layer validates against them, and the TS types below flow through the whole app.

export const ActivityKind = z.enum(["EVENT", "RECURRING", "PLACE"]);
export type ActivityKind = z.infer<typeof ActivityKind>;

export const Setting = z.enum(["INDOOR", "OUTDOOR", "EITHER"]);
export type Setting = z.infer<typeof Setting>;

export const Verification = z.enum([
  "OFFICIAL",
  "COMMUNITY_VERIFIED",
  "UNVERIFIED",
]);
export type Verification = z.infer<typeof Verification>;

export const ActivityStatus = z.enum(["ACTIVE", "CANCELLED", "HIDDEN"]);
export type ActivityStatus = z.infer<typeof ActivityStatus>;

export const SourceType = z.enum([
  "FACEBOOK",
  "EVENTBRITE",
  "MEETUP",
  "WEB",
  "MANUAL",
  "SEED",
]);
export type SourceType = z.infer<typeof SourceType>;

export const ReportKind = z.enum(["STILL_HAPPENING", "CROWDED", "CANCELLED"]);
export type ReportKind = z.infer<typeof ReportKind>;

/// Which slice of time the map is showing.
export const WhenFilter = z.enum(["today", "weekend", "opennow", "all"]);
export type WhenFilter = z.infer<typeof WhenFilter>;

export const AgeGroupId = z.enum(["infant", "toddler", "preschool"]);
export type AgeGroupId = z.infer<typeof AgeGroupId>;

// --- Weekly opening hours -----------------------------------------------------
//
// Shared by RECURRING activities ("ludothèque, every Wednesday 14:00–17:00") and
// PLACEs with opening hours. Stored JSON-encoded in Activity.weeklyHours.

export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/// "HH:MM", 24-hour.
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM");

export const TimeRange = z
  .object({ start: timeString, end: timeString })
  .refine((r) => r.start < r.end, {
    message: "range must start before it ends",
  });
export type TimeRange = z.infer<typeof TimeRange>;

export const WeeklyHours = z.object({
  mon: z.array(TimeRange).optional(),
  tue: z.array(TimeRange).optional(),
  wed: z.array(TimeRange).optional(),
  thu: z.array(TimeRange).optional(),
  fri: z.array(TimeRange).optional(),
  sat: z.array(TimeRange).optional(),
  sun: z.array(TimeRange).optional(),
});
export type WeeklyHours = z.infer<typeof WeeklyHours>;

/** Parse the JSON string stored in Activity.weeklyHours, tolerating junk. */
export function parseWeeklyHours(raw: string | null): WeeklyHours | null {
  if (!raw) return null;
  try {
    const parsed = WeeklyHours.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
