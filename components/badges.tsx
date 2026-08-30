"use client";

import { AGE_GROUPS, getAgeGroup } from "@/lib/age";
import { useI18n } from "@/lib/i18n/context";
import type { AgeGroupId, Verification } from "@/lib/enums";
import type { WeatherIcon } from "@/lib/weather";
import {
  AgeIcon,
  IndoorIcon,
  OfficialIcon,
  OutdoorIcon,
  UnverifiedIcon,
  VerifiedIcon,
  WeatherGlyph,
} from "./icons";

/** Colour is never the only signal here — every badge carries a shape or a word. */

export function AgeBadge({
  id,
  showLabel = true,
}: {
  id: AgeGroupId;
  showLabel?: boolean;
}) {
  const { t } = useI18n();
  const group = getAgeGroup(id);
  const label = t.filters[id];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white"
      style={{ backgroundColor: group.colorVar }}
    >
      <AgeIcon id={group.icon} className="text-[0.9em]" />
      {showLabel ? label : <span className="sr-only">{label}</span>}
    </span>
  );
}

export function AgeGroupLegend() {
  const { t } = useI18n();
  return (
    <ul
      className="flex flex-wrap items-center gap-2"
      aria-label={t.a11y.ageGroupLegend}
    >
      {AGE_GROUPS.map((group) => (
        <li
          key={group.id}
          className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft"
        >
          <span
            aria-hidden="true"
            className="grid h-5 w-5 place-items-center rounded-full text-[11px] text-white"
            style={{ backgroundColor: group.colorVar }}
          >
            <AgeIcon id={group.icon} />
          </span>
          {t.filters[group.id]}
        </li>
      ))}
    </ul>
  );
}

const VERIFICATION_STYLES: Record<Verification, string> = {
  OFFICIAL: "bg-plum-700 text-white border-plum-900",
  COMMUNITY_VERIFIED: "bg-fern-100 text-fern-700 border-fern-500",
  UNVERIFIED: "bg-cream-deep text-ink-soft border-ouistiti-200",
};

const VERIFICATION_ICONS: Record<Verification, typeof OfficialIcon> = {
  OFFICIAL: OfficialIcon,
  COMMUNITY_VERIFIED: VerifiedIcon,
  UNVERIFIED: UnverifiedIcon,
};

export function VerificationBadge({
  verification,
  withHint = false,
}: {
  verification: Verification;
  withHint?: boolean;
}) {
  const { t } = useI18n();
  const label = t.verification[verification];
  const hint = t.verification[`${verification}_HINT` as const];
  const Icon = VERIFICATION_ICONS[verification];

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        className={`inline-flex w-fit items-center gap-1 rounded-full border-2 px-2 py-0.5 text-xs font-bold ${VERIFICATION_STYLES[verification]}`}
        title={hint}
      >
        <Icon className="text-[0.95em]" />
        {label}
      </span>
      {withHint ? <span className="text-xs text-ink-soft">{hint}</span> : null}
    </span>
  );
}

export function WeatherBadge({
  weather,
}: {
  weather: {
    icon: WeatherIcon;
    advisory: "GOOD" | "MARGINAL" | "POOR";
    temperatureC: number;
  };
}) {
  const { t } = useI18n();
  const tone =
    weather.advisory === "GOOD"
      ? "text-fern-700"
      : weather.advisory === "MARGINAL"
        ? "text-ouistiti-700"
        : "text-plum-700";

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold ${tone}`}
      title={t.weather[weather.advisory]}
    >
      <WeatherGlyph icon={weather.icon} className="text-[1.15em]" />
      {weather.temperatureC}°<span className="sr-only">{t.weather[weather.advisory]}</span>
    </span>
  );
}

export function SettingBadge({
  setting,
  compact = false,
}: {
  setting: "INDOOR" | "OUTDOOR";
  compact?: boolean;
}) {
  const { t } = useI18n();
  const Icon = setting === "INDOOR" ? IndoorIcon : OutdoorIcon;
  const label = setting === "INDOOR" ? t.activity.indoor : t.activity.outdoor;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-cream-deep px-2 py-0.5 text-xs font-semibold text-ink-soft"
      title={compact ? label : undefined}
    >
      <Icon className="text-[1.05em]" />
      {/* "En plein air" is long enough to wrap the feed's badge row on its own,
          so the list shows the shape alone and keeps the label for screen
          readers. The detail view has room for the words. */}
      {compact ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}
