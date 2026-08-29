import type { Setting } from "./enums";

/**
 * Weather matters here for exactly one decision: is going outside with a small
 * child a good idea right now? So the forecast collapses to a three-way advisory
 * rather than a temperature readout nobody has time to interpret.
 */

export type OutdoorAdvisory = "GOOD" | "MARGINAL" | "POOR";

export interface WeatherSnapshot {
  temperatureC: number;
  precipitationProbability: number;
  /** WMO weather interpretation code, as returned by Open-Meteo. */
  weatherCode: number;
  windSpeedKmh: number;
}

export interface WeatherVerdict extends WeatherSnapshot {
  advisory: OutdoorAdvisory;
  /** Icon key the UI maps to a glyph — never rendered raw. */
  icon: WeatherIcon;
}

export type WeatherIcon =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

/** WMO code → icon. Grouped the way the sky actually looks, not by code order. */
export function iconForCode(code: number): WeatherIcon {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  // WMO codes stop at 99; an unbounded `>= 95` would classify any stray number
  // as a thunderstorm and needlessly rule out going outside.
  if (code >= 95 && code <= 99) return "thunder";
  return "cloudy";
}

/**
 * Thresholds are set for a pushchair and a toddler who will refuse a hat, which
 * is a lower bar than an adult would use: 6°C with drizzle is a "no" here even
 * though a grown-up would happily walk in it.
 */
export function advisoryFor(snapshot: WeatherSnapshot): OutdoorAdvisory {
  const icon = iconForCode(snapshot.weatherCode);

  if (icon === "thunder" || icon === "snow") return "POOR";
  if (icon === "rain") return "POOR";
  if (snapshot.precipitationProbability >= 70) return "POOR";
  if (snapshot.temperatureC <= 2 || snapshot.temperatureC >= 32) return "POOR";
  if (snapshot.windSpeedKmh >= 40) return "POOR";

  if (icon === "drizzle" || icon === "fog") return "MARGINAL";
  if (snapshot.precipitationProbability >= 35) return "MARGINAL";
  if (snapshot.temperatureC <= 8 || snapshot.temperatureC >= 29) return "MARGINAL";
  if (snapshot.windSpeedKmh >= 25) return "MARGINAL";

  return "GOOD";
}

export function verdictFor(snapshot: WeatherSnapshot): WeatherVerdict {
  return {
    ...snapshot,
    advisory: advisoryFor(snapshot),
    icon: iconForCode(snapshot.weatherCode),
  };
}

/**
 * How an activity should present itself given the sky. An EITHER activity — a
 * covered market, a museum courtyard — resolves to whichever side the weather
 * favours; INDOOR and OUTDOOR are properties of the venue and don't move.
 */
export function effectiveSetting(
  setting: Setting,
  verdict: WeatherVerdict | null,
): Exclude<Setting, "EITHER"> {
  if (setting !== "EITHER") return setting;
  if (!verdict) return "INDOOR";
  return verdict.advisory === "GOOD" ? "OUTDOOR" : "INDOOR";
}

/** Flag an outdoor activity whose weather has turned. Drives the card warning. */
export function shouldWarnAboutWeather(
  setting: Setting,
  verdict: WeatherVerdict | null,
): boolean {
  if (!verdict) return false;
  return setting === "OUTDOOR" && verdict.advisory === "POOR";
}
