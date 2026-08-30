import { prisma } from "./db";
import { ageGroupsFor, matchesAgeFilter } from "./age";
import { isWithinBBox, parseBBox } from "./geo";
import {
  endOfZonedDay,
  isOpenNow,
  nextOccurrenceFrom,
  occursWithin,
  startOfZonedDay,
  weekendWindow,
  type SchedulableActivity,
} from "./schedule";
import { effectiveSetting, shouldWarnAboutWeather } from "./weather";
import { getWeatherForPoints } from "./services/weather";
import { isReportFresh } from "./trust";
import type { ActivityQuery } from "./schemas";
import type {
  ActivityKind,
  AgeGroupId,
  Setting,
  SourceType,
  Verification,
  ActivityStatus,
} from "./enums";
import type { OutdoorAdvisory, WeatherIcon } from "./weather";

/** What the client actually receives. Dates are ISO strings over the wire. */
export interface ActivityDTO {
  id: string;
  kind: ActivityKind;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  venueName: string;
  address: string;
  city: string;
  postalCode: string | null;
  lat: number;
  lng: number;
  startsAt: string | null;
  endsAt: string | null;
  weeklyHours: string | null;
  alwaysOpen: boolean;
  ageMinMonths: number;
  ageMaxMonths: number;
  ageGroups: AgeGroupId[];
  priceCents: number | null;
  currency: string;
  isFree: boolean;
  dropIn: boolean;
  setting: Setting;
  /** What the setting resolves to once the weather is taken into account. */
  effectiveSetting: "INDOOR" | "OUTDOOR";
  verification: Verification;
  status: ActivityStatus;
  sourceType: SourceType;
  sourceUrl: string | null;
  /** The window this activity is being shown for, if there is one. */
  nextStart: string | null;
  nextEnd: string | null;
  openNow: boolean;
  weather: {
    advisory: OutdoorAdvisory;
    icon: WeatherIcon;
    temperatureC: number;
  } | null;
  weatherWarning: boolean;
  recentReports: number;
  lastReportAt: string | null;
}

const HORIZON_DAYS = 21;

type ActivityRow = Awaited<ReturnType<typeof prisma.activity.findMany>>[number];

interface ReportAggregate {
  recent: number;
  lastAt: Date | null;
}

function schedulable(row: ActivityRow): SchedulableActivity {
  return {
    kind: row.kind as ActivityKind,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    weeklyHours: row.weeklyHours,
    alwaysOpen: row.alwaysOpen,
  };
}

/**
 * The time window the "when" filter is asking about. `all` and `opennow` have no
 * window — `opennow` is answered per-activity, since a place with opening hours
 * and a one-off event need different questions asked of them.
 */
function windowFor(when: ActivityQuery["when"], now: Date) {
  if (when === "today") {
    return { start: now, end: endOfZonedDay(now) };
  }
  if (when === "weekend") return weekendWindow(now);
  return null;
}

export interface ListOptions extends ActivityQuery {
  now?: Date;
  /** Skip the weather round-trip when the caller doesn't need it. */
  includeWeather?: boolean;
}

/**
 * The one place activities are queried and shaped.
 *
 * Age, bbox and schedule filters run in application code rather than SQL: they
 * depend on lib/age and lib/schedule, which are the tested source of truth for
 * those rules, and duplicating them as SQL predicates would be two definitions of
 * the same thing waiting to disagree. At this data size that costs nothing; if
 * the table grows past a city, the bbox is the one to push into the query first.
 */
export async function listActivities(
  options: ListOptions,
): Promise<ActivityDTO[]> {
  const now = options.now ?? new Date();
  const includeWeather = options.includeWeather ?? true;

  const rows = await prisma.activity.findMany({
    where: {
      status: { in: ["ACTIVE", "CANCELLED"] },
      ...(options.kind.length ? { kind: { in: options.kind } } : {}),
      ...(options.q
        ? {
            OR: [
              { title: { contains: options.q } },
              { titleEn: { contains: options.q } },
              { venueName: { contains: options.q } },
              { description: { contains: options.q } },
            ],
          }
        : {}),
    },
    orderBy: [{ startsAt: "asc" }, { title: "asc" }],
  });

  const bbox = parseBBox(options.bbox ?? null);
  const window = windowFor(options.when, now);

  const matched = rows.filter((row) => {
    if (bbox && !isWithinBBox({ lat: row.lat, lng: row.lng }, bbox)) return false;
    if (!matchesAgeFilter(row, options.age)) return false;

    if (options.setting.length) {
      // An EITHER activity satisfies a filter for either side.
      const setting = row.setting as Setting;
      const satisfies =
        setting === "EITHER" || options.setting.includes(setting);
      if (!satisfies) return false;
    }

    if (options.when === "opennow") return isOpenNow(schedulable(row), now);
    if (window) return occursWithin(schedulable(row), window);

    // "all": hide one-off events that are already over, but never hide a place.
    const activity = schedulable(row);
    if (activity.kind === "EVENT") {
      return nextOccurrenceFrom(activity, now, HORIZON_DAYS) !== null;
    }
    return true;
  });

  const limited = matched.slice(0, options.limit);
  const reports = await aggregateReports(
    limited.map((r) => r.id),
    now,
  );

  const weather = includeWeather
    ? await getWeatherForPoints(
        limited.map((row) => ({
          id: row.id,
          lat: row.lat,
          lng: row.lng,
          at: nextOccurrenceFrom(schedulable(row), now, HORIZON_DAYS)?.start ?? now,
        })),
      )
    : new Map();

  const dtos = limited.map((row) =>
    toDTO(row, {
      now,
      weather: weather.get(row.id) ?? null,
      reports: reports.get(row.id) ?? { recent: 0, lastAt: null },
    }),
  );

  // Sort by what's happening soonest; places with no next window go last but stay
  // visible, because "the playground is always there" is a real answer.
  return dtos.sort((a, b) => {
    const aTime = a.nextStart ? Date.parse(a.nextStart) : Number.MAX_SAFE_INTEGER;
    const bTime = b.nextStart ? Date.parse(b.nextStart) : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return a.title.localeCompare(b.title);
  });
}

export async function getActivity(
  id: string,
  now: Date = new Date(),
): Promise<ActivityDTO | null> {
  const row = await prisma.activity.findUnique({ where: { id } });
  if (!row || row.status === "HIDDEN") return null;

  const [reports, weather] = await Promise.all([
    aggregateReports([row.id], now),
    getWeatherForPoints([
      {
        id: row.id,
        lat: row.lat,
        lng: row.lng,
        at: nextOccurrenceFrom(schedulable(row), now, HORIZON_DAYS)?.start ?? now,
      },
    ]),
  ]);

  return toDTO(row, {
    now,
    weather: weather.get(row.id) ?? null,
    reports: reports.get(row.id) ?? { recent: 0, lastAt: null },
  });
}

async function aggregateReports(
  ids: string[],
  now: Date,
): Promise<Map<string, ReportAggregate>> {
  const out = new Map<string, ReportAggregate>();
  if (ids.length === 0) return out;

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await prisma.statusReport.findMany({
    where: { activityId: { in: ids }, createdAt: { gte: since } },
    select: { activityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  for (const row of rows) {
    const entry = out.get(row.activityId) ?? { recent: 0, lastAt: null };
    if (isReportFresh({ createdAt: row.createdAt }, now, 60 * 60 * 1000)) {
      entry.recent += 1;
    }
    if (!entry.lastAt || row.createdAt > entry.lastAt) entry.lastAt = row.createdAt;
    out.set(row.activityId, entry);
  }

  return out;
}

function toDTO(
  row: ActivityRow,
  context: {
    now: Date;
    weather: Awaited<ReturnType<typeof getWeatherForPoints>> extends Map<
      string,
      infer V
    >
      ? V
      : never;
    reports: ReportAggregate;
  },
): ActivityDTO {
  const activity = schedulable(row);
  const next = nextOccurrenceFrom(activity, context.now, HORIZON_DAYS);
  const setting = row.setting as Setting;
  const verdict = context.weather;

  return {
    id: row.id,
    kind: row.kind as ActivityKind,
    title: row.title,
    titleEn: row.titleEn,
    description: row.description,
    descriptionEn: row.descriptionEn,
    venueName: row.venueName,
    address: row.address,
    city: row.city,
    postalCode: row.postalCode,
    lat: row.lat,
    lng: row.lng,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    weeklyHours: row.weeklyHours,
    alwaysOpen: row.alwaysOpen,
    ageMinMonths: row.ageMinMonths,
    ageMaxMonths: row.ageMaxMonths,
    ageGroups: ageGroupsFor(row).map((g) => g.id),
    priceCents: row.priceCents,
    currency: row.currency,
    isFree: row.isFree,
    dropIn: row.dropIn,
    setting,
    effectiveSetting: effectiveSetting(setting, verdict),
    verification: row.verification as Verification,
    status: row.status as ActivityStatus,
    sourceType: row.sourceType as SourceType,
    sourceUrl: row.sourceUrl,
    nextStart: next?.start.toISOString() ?? null,
    nextEnd: next?.end.toISOString() ?? null,
    openNow: isOpenNow(activity, context.now),
    weather: verdict
      ? {
          advisory: verdict.advisory,
          icon: verdict.icon,
          temperatureC: Math.round(verdict.temperatureC),
        }
      : null,
    weatherWarning: shouldWarnAboutWeather(setting, verdict),
    recentReports: context.reports.recent,
    lastReportAt: context.reports.lastAt?.toISOString() ?? null,
  };
}

/** Re-export so the schedule window helpers are reachable from one import. */
export { startOfZonedDay, endOfZonedDay, weekendWindow };
