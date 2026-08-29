export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in metres. Haversine is accurate to well under a metre at
 * the scale we care about (a 100 m verification radius), and needs no dependencies.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/** Parse the "minLng,minLat,maxLng,maxLat" query param (OSM/Leaflet ordering). */
export function parseBBox(raw: string | null): BBox | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number.parseFloat(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;

  const [minLng, minLat, maxLng, maxLat] = parts as [
    number,
    number,
    number,
    number,
  ];
  if (minLat > maxLat || minLng > maxLng) return null;
  if (Math.abs(minLat) > 90 || Math.abs(maxLat) > 90) return null;
  if (Math.abs(minLng) > 180 || Math.abs(maxLng) > 180) return null;

  return { minLat, minLng, maxLat, maxLng };
}

export function isWithinBBox(point: LatLng, box: BBox): boolean {
  return (
    point.lat >= box.minLat &&
    point.lat <= box.maxLat &&
    point.lng >= box.minLng &&
    point.lng <= box.maxLng
  );
}

/** Where the map opens before anyone grants location: Place de la Palud. */
export const LAUSANNE_CENTER: LatLng = { lat: 46.5218, lng: 6.6327 };

/** Round coordinates for use in a cache key — ~1 km buckets, plenty for weather. */
export function coarseKey(point: LatLng): string {
  return `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`;
}
