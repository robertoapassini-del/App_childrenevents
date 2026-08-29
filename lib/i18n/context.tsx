"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { TIMEZONE } from "../schedule";
import {
  getDictionary,
  interpolate,
  localeTag,
  type Dictionary,
  type Locale,
} from "./index";

interface I18nValue {
  locale: Locale;
  t: Dictionary;
  /** Fill {placeholders}: `fmt(t.status.lastSeen, { time: "10 min" })`. */
  fmt: (template: string, values: Record<string, string | number>) => string;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (value: Date | string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(() => {
    const tag = localeTag(locale);
    return {
      locale,
      t: getDictionary(locale),
      fmt: interpolate,
      // Always Lausanne time, never the device's. A storytime at 10:00 is at
      // 10:00 whether you're reading this in Lausanne, on a train, or on a
      // phone whose clock is set to somewhere else entirely.
      formatDate: (value, options) =>
        new Intl.DateTimeFormat(tag, {
          timeZone: TIMEZONE,
          weekday: "short",
          day: "numeric",
          month: "short",
          ...options,
        }).format(typeof value === "string" ? new Date(value) : value),
      formatTime: (value) =>
        new Intl.DateTimeFormat(tag, {
          timeZone: TIMEZONE,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(typeof value === "string" ? new Date(value) : value),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside an I18nProvider");
  return value;
}

/** "il y a 12 min" — the freshness line on status reports. */
export function useRelativeTime() {
  const { t, fmt } = useI18n();
  return (value: Date | string, now: Date = new Date()): string => {
    const then = typeof value === "string" ? new Date(value) : value;
    const seconds = Math.max(0, (now.getTime() - then.getTime()) / 1000);

    if (seconds < 90) return t.time.justNow;
    if (seconds < 3600) {
      return fmt(t.time.minutes, { count: Math.round(seconds / 60) });
    }
    if (seconds < 86_400) {
      return fmt(t.time.hours, { count: Math.round(seconds / 3600) });
    }
    return fmt(t.time.days, { count: Math.round(seconds / 86_400) });
  };
}
