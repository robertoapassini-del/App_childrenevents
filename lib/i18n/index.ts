import { en } from "./en";
import { fr, type Dictionary } from "./fr";

export type Locale = "fr" | "en";
export type { Dictionary };

export const LOCALES: readonly Locale[] = ["fr", "en"] as const;
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "oui_lang";

const DICTIONARIES: Record<Locale, Dictionary> = { fr, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "fr" || value === "en";
}

/**
 * Resolve the locale from, in order: an explicit ?lang= (so a shared link can
 * carry it), the cookie, then the browser's Accept-Language. French wins ties —
 * this is a Lausanne app.
 */
export function resolveLocale(input: {
  param?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.param)) return input.param;
  if (isLocale(input.cookie)) return input.cookie;

  const header = input.acceptLanguage?.toLowerCase() ?? "";
  // Only prefer English when it actually outranks French in the header.
  const frIndex = header.indexOf("fr");
  const enIndex = header.indexOf("en");
  if (enIndex !== -1 && (frIndex === -1 || enIndex < frIndex)) return "en";

  return DEFAULT_LOCALE;
}

/** Fill {placeholders} in a dictionary string. */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** Swiss formats: 24-hour clock, CHF, day-before-month. */
export function localeTag(locale: Locale): string {
  return locale === "fr" ? "fr-CH" : "en-CH";
}

export function formatPrice(
  cents: number | null | undefined,
  locale: Locale,
  currency = "CHF",
): string | null {
  if (cents === null || cents === undefined) return null;
  if (cents === 0) return getDictionary(locale).activity.free;
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Pick the English title/description when there is one, else fall back to French. */
export function localizedField(
  base: string | null,
  english: string | null,
  locale: Locale,
): string | null {
  if (locale === "en" && english) return english;
  return base;
}
