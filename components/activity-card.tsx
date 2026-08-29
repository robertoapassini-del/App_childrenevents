"use client";

import { formatAgeRange } from "@/lib/age";
import { zonedDayKey } from "@/lib/schedule";
import { formatPrice, localizedField } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";
import type { ActivityDTO } from "@/lib/activities";
import { AgeBadge, SettingBadge, VerificationBadge, WeatherBadge } from "./badges";

/** How the time line reads depends on what kind of thing this is. */
function useWhenLabel() {
  const { t, formatDate, formatTime, locale } = useI18n();

  return (activity: ActivityDTO): string => {
    if (activity.kind === "PLACE" && activity.alwaysOpen) {
      return t.activity.alwaysOpen;
    }

    if (!activity.nextStart) {
      return activity.openNow ? t.activity.openNow : t.activity.closedNow;
    }

    const start = new Date(activity.nextStart);
    const now = new Date();
    // Compared as Lausanne days, so "today" means today there, not wherever the
    // reader's device happens to think it is.
    const sameDay = zonedDayKey(start) === zonedDayKey(now);
    const tomorrow =
      zonedDayKey(start) === zonedDayKey(new Date(now.getTime() + 86_400_000));

    const time = formatTime(start);
    if (sameDay) return `${t.activity.today} · ${time}`;
    if (tomorrow) return `${t.activity.tomorrow} · ${time}`;

    return `${formatDate(start, { weekday: "short", day: "numeric", month: locale === "fr" ? "long" : "short" })} · ${time}`;
  };
}

export function ActivityCard({
  activity,
  onSelect,
  selected = false,
}: {
  activity: ActivityDTO;
  onSelect: (activity: ActivityDTO) => void;
  selected?: boolean;
}) {
  const { t, locale, fmt } = useI18n();
  const whenLabel = useWhenLabel();

  const title =
    localizedField(activity.title, activity.titleEn, locale) ?? activity.title;
  const price = activity.isFree
    ? t.activity.free
    : formatPrice(activity.priceCents, locale, activity.currency);

  const cancelled = activity.status === "CANCELLED";

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(activity)}
        aria-label={fmt(t.a11y.openDetail, { title })}
        className={`card w-full text-left transition-transform active:scale-[0.99] ${
          selected ? "border-ouistiti-500 ring-2 ring-ouistiti-300" : ""
        } ${cancelled ? "opacity-70" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wide text-ouistiti-700 uppercase">
              {whenLabel(activity)}
            </p>
            <h3 className="mt-0.5 truncate text-base leading-snug font-extrabold text-ink">
              {cancelled ? <s>{title}</s> : title}
            </h3>
            <p className="mt-0.5 truncate text-sm text-ink-soft">
              {activity.venueName}
            </p>
          </div>
          {activity.weather ? <WeatherBadge weather={activity.weather} /> : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {activity.ageGroups.map((id) => (
            <AgeBadge key={id} id={id} showLabel={false} />
          ))}
          <span className="text-xs font-semibold text-ink-soft">
            {formatAgeRange(activity, locale)}
          </span>
          <SettingBadge setting={activity.effectiveSetting} />
          {price ? (
            <span className="rounded-full bg-ouistiti-100 px-2 py-0.5 text-xs font-bold text-ouistiti-800">
              {price}
            </span>
          ) : null}
          {activity.dropIn ? (
            <span className="rounded-full bg-fern-100 px-2 py-0.5 text-xs font-bold text-fern-700">
              {t.activity.dropIn}
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <VerificationBadge verification={activity.verification} />
          {cancelled ? (
            <span className="rounded-full bg-plum-100 px-2 py-0.5 text-xs font-bold text-plum-700">
              {t.activity.cancelled}
            </span>
          ) : null}
          {activity.weatherWarning ? (
            <span className="text-xs font-semibold text-plum-700">
              {t.activity.weatherWarning}
            </span>
          ) : null}
        </div>
      </button>
    </li>
  );
}
