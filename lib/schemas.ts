import { z } from "zod";
import {
  ActivityKind,
  AgeGroupId,
  ReportKind,
  Setting,
  SourceType,
  WeeklyHours,
  WhenFilter,
} from "./enums";

/** Every API boundary validates through this module. Nothing is trusted raw. */

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

/**
 * A comma-separated query param, narrowed to a known set.
 *
 * Unrecognised values are dropped rather than rejected: these arrive from URLs
 * that get shared, bookmarked and outlive schema changes, and showing a slightly
 * wider set of activities beats a 400 on a link somebody sent to a friend.
 */
const csv = <T extends string>(allowed: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((raw) =>
      (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is T => (allowed as readonly string[]).includes(s)),
    );

export const ActivityQuery = z.object({
  bbox: z.string().optional(),
  age: csv(AgeGroupId.options),
  setting: csv(Setting.options),
  when: WhenFilter.default("all"),
  kind: csv(ActivityKind.options),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ActivityQuery = z.infer<typeof ActivityQuery>;

/**
 * The shape of a new activity. Shared by the manual form and the confirmed
 * output of the ingestion chain — a parsed draft has to satisfy exactly the same
 * rules as something typed by hand, so the model can't smuggle in a bad record.
 */
export const ActivityInput = z
  .object({
    kind: ActivityKind,
    title: z.string().trim().min(3).max(160),
    titleEn: z.string().trim().max(160).nullish(),
    description: z.string().trim().max(2000).nullish(),
    descriptionEn: z.string().trim().max(2000).nullish(),

    venueName: z.string().trim().min(2).max(160),
    address: z.string().trim().min(3).max(240),
    city: z.string().trim().max(80).default("Lausanne"),
    postalCode: z.string().trim().max(12).nullish(),
    lat: latitude.nullish(),
    lng: longitude.nullish(),

    startsAt: z.coerce.date().nullish(),
    endsAt: z.coerce.date().nullish(),
    weeklyHours: WeeklyHours.nullish(),
    alwaysOpen: z.boolean().default(false),

    ageMinMonths: z.number().int().min(0).max(216).default(0),
    ageMaxMonths: z.number().int().min(0).max(216).default(60),

    priceCents: z.number().int().min(0).max(1_000_000).nullish(),
    isFree: z.boolean().default(false),
    dropIn: z.boolean().default(true),
    setting: Setting.default("INDOOR"),

    sourceType: SourceType.default("MANUAL"),
    sourceUrl: z.url().max(2048).nullish(),
  })
  .refine((a) => a.ageMinMonths < a.ageMaxMonths, {
    message: "The age range has to start below where it ends.",
    path: ["ageMaxMonths"],
  })
  .refine((a) => a.kind !== "EVENT" || Boolean(a.startsAt), {
    message: "A one-off event needs a start date.",
    path: ["startsAt"],
  })
  .refine((a) => !a.startsAt || !a.endsAt || a.endsAt > a.startsAt, {
    message: "It can't finish before it starts.",
    path: ["endsAt"],
  })
  .refine(
    (a) =>
      a.kind === "EVENT" ||
      a.alwaysOpen ||
      (a.weeklyHours && Object.values(a.weeklyHours).some((d) => d?.length)),
    {
      message:
        "A weekly activity or a place needs opening hours, unless it's always open.",
      path: ["weeklyHours"],
    },
  );
export type ActivityInput = z.infer<typeof ActivityInput>;

export const ReportInput = z.object({
  kind: ReportKind,
  lat: latitude.nullish(),
  lng: longitude.nullish(),
  /** Browser-reported GPS accuracy in metres, when available. */
  accuracy: z.number().min(0).max(100_000).nullish(),
});
export type ReportInput = z.infer<typeof ReportInput>;

export const WeatherQuery = z.object({
  lat: z.coerce.number().pipe(latitude),
  lng: z.coerce.number().pipe(longitude),
  at: z.coerce.date().optional(),
});

export const IngestLinkInput = z.object({
  url: z.url().max(2048),
});

export const IngestTextInput = z.object({
  text: z.string().trim().min(20).max(20_000),
  sourceUrl: z.url().max(2048).nullish(),
});
