"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useFilters } from "@/lib/use-filters";
import { useGeolocation } from "@/lib/use-geolocation";
import type { ActivityDTO } from "@/lib/activities";
import { ActivityCard } from "./activity-card";
import { FilterBar } from "./filter-bar";
import { AgeGroupLegend } from "./badges";
import { ActivityDetail } from "./activity-detail";
import { LanguageToggle } from "./language-toggle";
import { NearMeIcon, PlusIcon } from "./icons";
import { useSheet } from "@/lib/use-sheet";

// Leaflet reaches for `window` at import time, so the map can only load in the
// browser. The placeholder keeps the layout from jumping when it arrives.
const ActivityMap = dynamic(() => import("./activity-map"), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

function MapPlaceholder() {
  return (
    <div className="grid h-full w-full place-items-center bg-cream-deep">
      <p className="text-sm font-bold text-ink-soft">…</p>
    </div>
  );
}

export function MapScreen({ initialActivities }: { initialActivities: ActivityDTO[] }) {
  const { t, fmt } = useI18n();
  const controls = useFilters();
  const { filters, apiQuery, selectActivity } = controls;
  const geo = useGeolocation();
  const sheet = useSheet();

  const [activities, setActivities] = useState(initialActivities);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    null,
  );

  // Refetch whenever the filters change. The first render can skip it, because
  // the server already rendered a list for exactly these filters.
  //
  // Both latches are refs, not state, and that is load-bearing: with a state
  // latch, a tap landing before React commits the "no longer first render"
  // update runs this effect with the stale value, so it consumes the latch and
  // returns *without fetching* — the filter pill lights up and the list never
  // changes. Refs mutate synchronously, so there is no window to lose. The
  // query comparison covers the same race from the other side: if the filters
  // already moved on from what the server rendered, fetch regardless.
  const serverQuery = useRef(apiQuery);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current && apiQuery === serverQuery.current) {
      hasFetched.current = true;
      return;
    }
    hasFetched.current = true;

    const controller = new AbortController();
    setLoading(true);
    setFailed(false);

    fetch(`/api/activities?${apiQuery}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data: { activities: ActivityDTO[] }) => {
        setActivities(data.activities);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setFailed(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [apiQuery]);

  const selected = useMemo(
    () => activities.find((a) => a.id === filters.activityId) ?? null,
    [activities, filters.activityId],
  );

  const handleSelect = useCallback(
    (activity: ActivityDTO) => {
      selectActivity(activity.id);
      setFocus({ lat: activity.lat, lng: activity.lng, zoom: 16 });
    },
    [selectActivity],
  );

  const handleNearMe = useCallback(async () => {
    const position = await geo.request();
    if (position) setFocus({ lat: position.lat, lng: position.lng, zoom: 15 });
  }, [geo]);

  /** Reflect a status report back into the list without a full refetch. */
  const handleActivityUpdated = useCallback((updated: ActivityDTO) => {
    setActivities((current) =>
      current.map((a) => (a.id === updated.id ? updated : a)),
    );
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="z-[500] shrink-0 border-b-2 border-ouistiti-100 bg-cream/95 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
          <div className="min-w-0">
            <h1 className="text-lg leading-none font-extrabold tracking-tight text-ouistiti-700">
              {t.appName}
            </h1>
            {/* The tagline is a nicety; on a narrow phone the filters matter
                more, so it only appears once there's room for it in full. */}
            <p className="mt-0.5 hidden text-xs text-ink-soft sm:block">
              {t.tagline}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <LanguageToggle />
            <Link
              href="/ajouter"
              className="tap inline-flex items-center rounded-full bg-ouistiti-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-ouistiti-600"
            >
              <PlusIcon className="mr-0.5 text-base" />
              {t.nav.add}
            </Link>
          </div>
        </div>
        <FilterBar controls={controls} />
      </header>

      <main id="main" className="relative min-h-0 flex-1 lg:flex">
        {/* Map: full-bleed behind the sheet on mobile, a panel on desktop. */}
        <div className="absolute inset-0 lg:relative lg:flex-1">
          <ActivityMap
            activities={activities}
            selectedId={filters.activityId}
            onSelect={handleSelect}
            focus={focus}
            userPosition={geo.position}
          />

          <button
            type="button"
            onClick={handleNearMe}
            disabled={geo.isLocating}
            className="tap absolute top-3 right-3 z-[400] inline-flex items-center gap-1.5 rounded-full border-2 border-ouistiti-200 bg-white px-3.5 text-sm font-bold text-ink shadow-md disabled:opacity-60"
          >
            <NearMeIcon className="text-base" />
            {geo.isLocating ? t.status.locating : t.filters.nearMe}
          </button>
        </div>

        {/* The feed. A draggable bottom sheet on mobile, a fixed column on
            desktop, where there's room for both at once and no gesture needed. */}
        <section
          aria-label={t.nav.map}
          style={{ height: `${sheet.height * 100}%` }}
          className={`absolute inset-x-0 bottom-0 z-[450] lg:relative lg:inset-auto lg:!h-auto lg:w-[27rem] lg:shrink-0 lg:border-l-2 lg:border-ouistiti-100 ${
            sheet.isDragging ? "" : "transition-[height] duration-200 ease-out"
          }`}
        >
          <div className="relative flex h-full flex-col rounded-t-[var(--radius-blob)] border-t-2 border-ouistiti-200 bg-cream shadow-[0_-6px_24px_rgba(42,31,26,.14)] lg:rounded-none lg:border-t-0 lg:shadow-none">
            {/* The grab area. A real target, not a decorative line: it drags,
                it responds to a tap, and it is reachable from the keyboard. */}
            <button
              type="button"
              {...sheet.handleProps}
              onClick={sheet.toggle}
              aria-expanded={sheet.position === "expanded"}
              aria-label={t.a11y.toggleSheet}
              className="group absolute inset-x-0 top-0 z-10 flex h-7 touch-none items-center justify-center lg:hidden"
            >
              <span className="h-1.5 w-12 rounded-full bg-ouistiti-300 transition-colors group-hover:bg-ouistiti-400" />
            </button>

            <div className="flex items-center justify-between gap-2 px-4 pt-6 pb-1.5 lg:pt-2.5">
              <p className="text-sm font-extrabold text-ink">
                {loading
                  ? t.empty.loading
                  : fmt(
                      activities.length === 1 ? t.list.count : t.list.countPlural,
                      { count: activities.length },
                    )}
              </p>
              <AgeGroupLegend />
            </div>

            <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {failed ? (
                <li className="card text-center">
                  <p className="font-extrabold">{t.empty.error}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t.empty.errorHint}</p>
                </li>
              ) : activities.length === 0 && !loading ? (
                <li className="card text-center">
                  <p className="font-extrabold">{t.empty.noResults}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {t.empty.noResultsHint}
                  </p>
                </li>
              ) : (
                activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onSelect={handleSelect}
                    selected={activity.id === filters.activityId}
                  />
                ))
              )}
            </ul>
          </div>
        </section>

        {selected ? (
          <ActivityDetail
            activity={selected}
            onClose={() => selectActivity(null)}
            onUpdated={handleActivityUpdated}
          />
        ) : null}
      </main>
    </div>
  );
}
