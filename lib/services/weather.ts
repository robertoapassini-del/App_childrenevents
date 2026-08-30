import { prisma } from "../db";
import { coarseKey, type LatLng } from "../geo";
import { verdictFor, type WeatherSnapshot, type WeatherVerdict } from "../weather";

/**
 * Open-Meteo, which needs no API key and permits non-commercial use. Cached in the
 * database on a coarse coordinate grid plus the hour, because every activity in
 * central Lausanne shares a forecast and there is no sense fetching it 27 times.
 *
 * Weather is a nice-to-have here: every failure degrades to "no forecast", never
 * to an error the parent has to deal with.
 */

const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

export function isMocked(): boolean {
  return process.env.MOCK_EXTERNAL === "1";
}

/** Deterministic stand-in for offline dev, CI, and sandboxes without egress. */
function mockSnapshot(point: LatLng, at: Date): WeatherSnapshot {
  // Varies with the hour so the UI shows more than one state while developing,
  // but is stable for a given hour so tests and screenshots don't flicker.
  const hour = at.getUTCHours();
  const bucket = (Math.floor(point.lat * 100) + hour) % 4;
  const table: WeatherSnapshot[] = [
    { temperatureC: 22, precipitationProbability: 5, weatherCode: 0, windSpeedKmh: 7 },
    { temperatureC: 18, precipitationProbability: 20, weatherCode: 2, windSpeedKmh: 12 },
    { temperatureC: 13, precipitationProbability: 55, weatherCode: 53, windSpeedKmh: 18 },
    { temperatureC: 9, precipitationProbability: 85, weatherCode: 63, windSpeedKmh: 26 },
  ];
  return table[bucket]!;
}

function cacheKey(point: LatLng, at: Date): string {
  return `${coarseKey(point)}@${at.toISOString().slice(0, 13)}`;
}

interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
    wind_speed_10m?: number[];
  };
}

/** Pick the forecast hour nearest to the moment we care about. */
function snapshotFromResponse(
  data: OpenMeteoResponse,
  at: Date,
): WeatherSnapshot | null {
  const hourly = data.hourly;
  if (!hourly?.time?.length) return null;

  const target = at.getTime();
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;

  hourly.time.forEach((iso, index) => {
    // Open-Meteo returns local naive times; we request UTC to keep this honest.
    const delta = Math.abs(new Date(`${iso}Z`).getTime() - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  });

  const temperatureC = hourly.temperature_2m?.[bestIndex];
  const weatherCode = hourly.weather_code?.[bestIndex];
  if (temperatureC === undefined || weatherCode === undefined) return null;

  return {
    temperatureC,
    weatherCode,
    precipitationProbability: hourly.precipitation_probability?.[bestIndex] ?? 0,
    windSpeedKmh: hourly.wind_speed_10m?.[bestIndex] ?? 0,
  };
}

async function fetchFromOpenMeteo(
  point: LatLng,
  at: Date,
): Promise<WeatherSnapshot | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", point.lat.toFixed(4));
  url.searchParams.set("longitude", point.lng.toFixed(4));
  url.searchParams.set(
    "hourly",
    "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
  );
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", "7");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  return snapshotFromResponse((await response.json()) as OpenMeteoResponse, at);
}

/**
 * The forecast for a point at a moment, or null if we simply couldn't get one.
 * Never throws — the caller renders the activity either way.
 */
export async function getWeather(
  point: LatLng,
  at: Date = new Date(),
): Promise<WeatherVerdict | null> {
  if (isMocked()) return verdictFor(mockSnapshot(point, at));

  const key = cacheKey(point, at);

  try {
    const cached = await prisma.weatherCache.findUnique({ where: { key } });
    if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      return verdictFor(JSON.parse(cached.payload) as WeatherSnapshot);
    }
  } catch {
    // A cache miss or a malformed row is not worth failing over.
  }

  let snapshot: WeatherSnapshot | null = null;
  try {
    snapshot = await fetchFromOpenMeteo(point, at);
  } catch {
    return null;
  }
  if (!snapshot) return null;

  try {
    const payload = JSON.stringify(snapshot);
    await prisma.weatherCache.upsert({
      where: { key },
      create: { key, payload },
      update: { payload, fetchedAt: new Date() },
    });
  } catch {
    // Serving the forecast matters more than caching it.
  }

  return verdictFor(snapshot);
}

/**
 * Forecasts for many points at once, de-duplicated onto the cache grid so a
 * screenful of activities in one neighbourhood costs a single upstream call.
 */
export async function getWeatherForPoints(
  points: { id: string; lat: number; lng: number; at: Date }[],
): Promise<Map<string, WeatherVerdict | null>> {
  const byKey = new Map<string, { point: LatLng; at: Date; ids: string[] }>();

  for (const p of points) {
    const point = { lat: p.lat, lng: p.lng };
    const key = cacheKey(point, p.at);
    const entry = byKey.get(key);
    if (entry) entry.ids.push(p.id);
    else byKey.set(key, { point, at: p.at, ids: [p.id] });
  }

  const results = new Map<string, WeatherVerdict | null>();
  await Promise.all(
    [...byKey.values()].map(async ({ point, at, ids }) => {
      const verdict = await getWeather(point, at);
      for (const id of ids) results.set(id, verdict);
    }),
  );

  return results;
}
