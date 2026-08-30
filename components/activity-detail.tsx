"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatAgeRange } from "@/lib/age";
import { parseWeeklyHours, WEEKDAYS } from "@/lib/enums";
import { formatPrice, localizedField } from "@/lib/i18n";
import { useI18n, useRelativeTime } from "@/lib/i18n/context";
import type { ActivityDTO } from "@/lib/activities";
import { AgeBadge, SettingBadge, VerificationBadge, WeatherBadge } from "./badges";
import { CloseIcon, DirectionsIcon, ShareIcon } from "./icons";
import { StatusButtons } from "./status-buttons";

/** Opening hours, rendered as the week rather than as a JSON blob. */
function OpeningHours({ weeklyHours }: { weeklyHours: string | null }) {
  const { t } = useI18n();
  const hours = parseWeeklyHours(weeklyHours);
  if (!hours) return null;

  const days = WEEKDAYS.filter((day) => hours[day]?.length);
  if (days.length === 0) return null;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {days.map((day) => (
        <div key={day} className="contents">
          <dt className="font-bold text-ink">{t.weekday[day]}</dt>
          <dd className="text-ink-soft">
            {hours[day]!.map((r) => `${r.start}–${r.end}`).join(", ")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ActivityDetailBody({
  activity: initialActivity,
  onUpdated,
}: {
  activity: ActivityDTO;
  onUpdated?: (activity: ActivityDTO) => void;
}) {
  const { t, locale, formatDate, formatTime } = useI18n();
  const relative = useRelativeTime();
  const [copied, setCopied] = useState(false);

  /**
   * The badge and report count are held here rather than read straight from the
   * prop, because this body renders in two places and only one of them has a
   * parent listening: the map overlay passes `onUpdated`, the shareable
   * /a/[id] page renders it on its own. Without local state, a parent who taps
   * "ça a lieu" on a shared link — and whose report is the second one, the one
   * that verifies the listing — watches the badge keep saying nobody has been
   * past to check. That is precisely the feedback the feature exists to give.
   */
  const [activity, setActivity] = useState(initialActivity);

  // The map overlay swaps which activity this shows without remounting, so the
  // local copy has to follow the prop. Adjusted during render rather than in an
  // effect — React re-runs this component before touching the DOM, where an
  // effect would paint the previous activity's details for a frame first.
  const [shownProp, setShownProp] = useState(initialActivity);
  if (shownProp !== initialActivity) {
    setShownProp(initialActivity);
    setActivity(initialActivity);
  }

  const handleUpdated = useCallback(
    (next: ActivityDTO) => {
      setActivity(next);
      onUpdated?.(next);
    },
    [onUpdated],
  );

  const title =
    localizedField(activity.title, activity.titleEn, locale) ?? activity.title;
  const description = localizedField(
    activity.description,
    activity.descriptionEn,
    locale,
  );
  const price = activity.isFree
    ? t.activity.free
    : formatPrice(activity.priceCents, locale, activity.currency);

  const mapsUrl = `https://www.openstreetmap.org/?mlat=${activity.lat}&mlon=${activity.lng}#map=18/${activity.lat}/${activity.lng}`;

  async function share() {
    const url = `${window.location.origin}/a/${activity.id}`;
    // The native sheet is what a parent actually wants — straight into WhatsApp.
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed, or unsupported in this context; fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Nothing sensible left to try.
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-ouistiti-100 px-2 py-0.5 text-xs font-bold text-ouistiti-800">
            {t.kind[activity.kind]}
          </span>
          {activity.weather ? <WeatherBadge weather={activity.weather} /> : null}
        </div>

        <h2 className="mt-1.5 text-xl leading-tight font-extrabold text-ink">
          {activity.status === "CANCELLED" ? <s>{title}</s> : title}
        </h2>

        {activity.status === "CANCELLED" ? (
          <p className="mt-1.5 rounded-2xl border-2 border-plum-300 bg-plum-50 px-3 py-2 text-sm font-bold text-plum-700">
            {t.activity.cancelledNote}
          </p>
        ) : null}

        {activity.weatherWarning ? (
          <p className="mt-1.5 text-sm font-semibold text-plum-700">
            {t.activity.weatherWarning}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {activity.ageGroups.map((id) => (
          <AgeBadge key={id} id={id} />
        ))}
        <span className="text-sm font-semibold text-ink-soft">
          {formatAgeRange(activity, locale)}
        </span>
        <SettingBadge setting={activity.effectiveSetting} />
        {price ? (
          <span className="rounded-full bg-ouistiti-100 px-2 py-0.5 text-xs font-bold text-ouistiti-800">
            {price}
          </span>
        ) : null}
        <span className="rounded-full bg-cream-deep px-2 py-0.5 text-xs font-bold text-ink-soft">
          {activity.dropIn ? t.activity.dropIn : t.activity.bookingRequired}
        </span>
      </div>

      {/* When */}
      <div className="rounded-2xl bg-cream-deep px-3 py-2.5">
        {activity.kind === "EVENT" && activity.nextStart ? (
          <p className="text-sm font-bold text-ink">
            {formatDate(activity.nextStart, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            {" · "}
            {formatTime(activity.nextStart)}
            {activity.nextEnd ? `–${formatTime(activity.nextEnd)}` : ""}
          </p>
        ) : activity.alwaysOpen ? (
          <p className="text-sm font-bold text-ink">{t.activity.alwaysOpen}</p>
        ) : (
          <>
            <p className="mb-1.5 text-xs font-bold tracking-wide text-ink-soft uppercase">
              {activity.openNow ? t.activity.openNow : t.activity.closedNow}
            </p>
            <OpeningHours weeklyHours={activity.weeklyHours} />
          </>
        )}
      </div>

      {description ? (
        <p className="text-sm leading-relaxed text-ink">{description}</p>
      ) : null}

      {/* Where */}
      <div>
        <p className="text-sm font-bold text-ink">{activity.venueName}</p>
        <p className="text-sm text-ink-soft">
          {activity.address}
          {activity.postalCode ? `, ${activity.postalCode}` : ""} {activity.city}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tap inline-flex items-center gap-1.5 rounded-full border-2 border-ouistiti-300 bg-white px-3.5 text-sm font-bold text-ouistiti-800 hover:bg-ouistiti-50"
          >
            <DirectionsIcon className="text-base" />
            {t.activity.directions}
          </a>
          <button
            type="button"
            onClick={share}
            className="tap inline-flex items-center gap-1.5 rounded-full border-2 border-ouistiti-300 bg-white px-3.5 text-sm font-bold text-ouistiti-800 hover:bg-ouistiti-50"
          >
            <ShareIcon className="text-base" />
            {copied ? t.activity.linkCopied : t.activity.share}
          </button>
        </div>
      </div>

      <StatusButtons activity={activity} onUpdated={handleUpdated} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ouistiti-100 pt-3">
        <VerificationBadge verification={activity.verification} withHint />
        {activity.lastReportAt ? (
          <span className="text-xs text-ink-soft">
            {t.status.lastSeen.replace("{time}", relative(activity.lastReportAt))}
          </span>
        ) : null}
      </div>

      {activity.sourceUrl ? (
        <p className="text-xs text-ink-soft">
          {t.activity.source}{" "}
          <a
            href={activity.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2"
          >
            {new URL(activity.sourceUrl).hostname.replace(/^www\./, "")}
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** The overlay version, used on the map screen. */
export function ActivityDetail({
  activity,
  onClose,
  onUpdated,
}: {
  activity: ActivityDTO;
  onClose: () => void;
  onUpdated?: (activity: ActivityDTO) => void;
}) {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-[600] flex items-end justify-center lg:items-center">
      <button
        type="button"
        aria-label={t.a11y.closeDetail}
        onClick={onClose}
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={activity.title}
        className="relative max-h-[88%] w-full overflow-y-auto overscroll-contain rounded-t-[var(--radius-blob)] border-t-2 border-ouistiti-300 bg-cream p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl lg:max-w-lg lg:rounded-[var(--radius-blob)] lg:border-2"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="tap absolute top-2.5 right-2.5 grid place-items-center rounded-full border-2 border-ouistiti-200 bg-white text-lg font-bold text-ink-soft hover:bg-ouistiti-50"
        >
          <CloseIcon className="text-base" />
          <span className="sr-only">{t.a11y.closeDetail}</span>
        </button>

        <div className="pr-10">
          <ActivityDetailBody activity={activity} onUpdated={onUpdated} />
        </div>
      </div>
    </div>
  );
}
