import { prisma } from "../db";
import { LAUSANNE_CENTER, type LatLng } from "../geo";
import { isMocked } from "./weather";

/**
 * Nominatim: free, keyless, and run on donated infrastructure — which is why this
 * caches every lookup permanently, sends a real User-Agent, and never issues more
 * than one request per second. Those are their usage terms, not optional politeness.
 */

const USER_AGENT =
  "Ouistiti/0.1 (toddler activity map, Lausanne; https://github.com/robertoapassini-del/app_childrenevents)";
const FETCH_TIMEOUT_MS = 8000;
const MIN_REQUEST_INTERVAL_MS = 1100;

export interface GeocodeResult extends LatLng {
  displayName: string | null;
}

let lastRequestAt = 0;

/** Serialise outbound calls to respect Nominatim's one-per-second limit. */
async function throttle(): Promise<void> {
  const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

function normalizeQuery(parts: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): string {
  return [parts.address, parts.postalCode, parts.city, "Switzerland"]
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.trim())
    .join(", ")
    .toLowerCase();
}

/** Offline stand-in: scatter deterministically around central Lausanne. */
function mockResult(query: string): GeocodeResult {
  let hash = 0;
  for (let i = 0; i < query.length; i += 1) {
    hash = (hash * 31 + query.charCodeAt(i)) | 0;
  }
  return {
    lat: LAUSANNE_CENTER.lat + ((hash % 200) - 100) / 20_000,
    lng: LAUSANNE_CENTER.lng + (((hash >> 8) % 200) - 100) / 20_000,
    displayName: `${query} (mock)`,
  };
}

interface NominatimHit {
  lat: string;
  lon: string;
  display_name?: string;
}

/**
 * Turn an address into coordinates, or null if it can't be resolved. Callers
 * decide what to do with a failure — the submit flow asks the parent to drop a
 * pin instead, rather than refusing the submission.
 */
export async function geocode(parts: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}): Promise<GeocodeResult | null> {
  const query = normalizeQuery(parts);
  if (!query || query === "switzerland") return null;

  if (isMocked()) return mockResult(query);

  try {
    const cached = await prisma.geocodeCache.findUnique({ where: { query } });
    if (cached) {
      return {
        lat: cached.lat,
        lng: cached.lng,
        displayName: cached.displayName,
      };
    }
  } catch {
    // Fall through to a live lookup.
  }

  let hit: NominatimHit | undefined;
  try {
    await throttle();
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "ch");

    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!response.ok) return null;

    const hits = (await response.json()) as NominatimHit[];
    hit = hits[0];
  } catch {
    return null;
  }

  if (!hit) return null;

  const result: GeocodeResult = {
    lat: Number.parseFloat(hit.lat),
    lng: Number.parseFloat(hit.lon),
    displayName: hit.display_name ?? null,
  };
  if (!Number.isFinite(result.lat) || !Number.isFinite(result.lng)) return null;

  try {
    await prisma.geocodeCache.upsert({
      where: { query },
      create: { query, ...result },
      update: { ...result, fetchedAt: new Date() },
    });
  } catch {
    // Caching is best-effort.
  }

  return result;
}
