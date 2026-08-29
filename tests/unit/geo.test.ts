import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  isWithinBBox,
  LAUSANNE_CENTER,
  parseBBox,
  coarseKey,
} from "@/lib/geo";

describe("haversineMeters", () => {
  it("is zero for a point against itself", () => {
    expect(haversineMeters(LAUSANNE_CENTER, LAUSANNE_CENTER)).toBe(0);
  });

  it("matches a known distance across Lausanne", () => {
    // Place de la Palud → Ouchy, roughly 1.5 km as the crow flies.
    const ouchy = { lat: 46.5065, lng: 6.627 };
    const d = haversineMeters(LAUSANNE_CENTER, ouchy);
    expect(d).toBeGreaterThan(1600);
    expect(d).toBeLessThan(1800);
  });

  it("is symmetric", () => {
    const a = { lat: 46.52, lng: 6.63 };
    const b = { lat: 46.54, lng: 6.65 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });

  it("resolves small offsets at the scale the trust radius cares about", () => {
    // ~0.0009° of latitude is very close to 100 m.
    const a = { lat: 46.52, lng: 6.63 };
    const b = { lat: 46.5209, lng: 6.63 };
    expect(haversineMeters(a, b)).toBeGreaterThan(95);
    expect(haversineMeters(a, b)).toBeLessThan(105);
  });
});

describe("parseBBox", () => {
  it("parses minLng,minLat,maxLng,maxLat", () => {
    expect(parseBBox("6.5,46.4,6.7,46.6")).toEqual({
      minLng: 6.5,
      minLat: 46.4,
      maxLng: 6.7,
      maxLat: 46.6,
    });
  });

  it("rejects the wrong number of components", () => {
    expect(parseBBox("6.5,46.4,6.7")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseBBox("a,b,c,d")).toBeNull();
  });

  it("rejects an inverted box", () => {
    expect(parseBBox("6.7,46.6,6.5,46.4")).toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    expect(parseBBox("6.5,-91,6.7,46.6")).toBeNull();
    expect(parseBBox("-181,46.4,6.7,46.6")).toBeNull();
  });

  it("returns null for a missing param", () => {
    expect(parseBBox(null)).toBeNull();
  });
});

describe("isWithinBBox", () => {
  const box = { minLng: 6.5, minLat: 46.4, maxLng: 6.7, maxLat: 46.6 };

  it("includes an interior point", () => {
    expect(isWithinBBox(LAUSANNE_CENTER, box)).toBe(true);
  });

  it("includes a point exactly on the edge", () => {
    expect(isWithinBBox({ lat: 46.4, lng: 6.5 }, box)).toBe(true);
  });

  it("excludes a point outside", () => {
    expect(isWithinBBox({ lat: 47.0, lng: 6.6 }, box)).toBe(false);
  });
});

describe("coarseKey", () => {
  it("buckets nearby points onto the same weather cache key", () => {
    expect(coarseKey({ lat: 46.5218, lng: 6.6327 })).toBe(
      coarseKey({ lat: 46.5241, lng: 6.6312 }),
    );
  });

  it("separates points that are genuinely far apart", () => {
    expect(coarseKey({ lat: 46.52, lng: 6.63 })).not.toBe(
      coarseKey({ lat: 46.6, lng: 6.7 }),
    );
  });
});
