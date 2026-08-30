import { describe, expect, it } from "vitest";
import {
  CLUSTER_RADIUS_PX,
  clusterBounds,
  clusterByPixel,
  type Clusterable,
} from "@/lib/cluster";
import { LAUSANNE_CENTER } from "@/lib/geo";

const at = (id: string, lat: number, lng: number): Clusterable => ({ id, lat, lng });

/** Roughly `metres` north of the map's default centre. */
const north = (id: string, metres: number): Clusterable =>
  at(id, LAUSANNE_CENTER.lat + metres / 111_320, LAUSANNE_CENTER.lng);

describe("clusterByPixel", () => {
  it("leaves well-separated points alone", () => {
    const clusters = clusterByPixel(
      [at("a", 46.52, 6.63), at("b", 46.6, 6.75), at("c", 46.45, 6.5)],
      14,
    );
    expect(clusters).toHaveLength(3);
    expect(clusters.every((c) => c.items.length === 1)).toBe(true);
  });

  it("groups points that would overlap on screen", () => {
    // Three venues within ~40 m of each other: one clump at any city zoom.
    const clusters = clusterByPixel(
      [north("a", 0), north("b", 20), north("c", 40)],
      14,
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items.map((i) => i.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("separates the same points once zoomed in far enough", () => {
    const points = [north("a", 0), north("b", 60), north("c", 120)];
    expect(clusterByPixel(points, 13)).toHaveLength(1);
    // At building zoom those 60 m gaps are hundreds of pixels apart.
    expect(clusterByPixel(points, 18)).toHaveLength(3);
  });

  it("keeps every point exactly once, whatever the zoom", () => {
    const points = Array.from({ length: 40 }, (_, i) =>
      at(`p${i}`, 46.5 + (i % 7) * 0.004, 6.6 + Math.floor(i / 7) * 0.004),
    );
    for (const zoom of [11, 13, 15, 17]) {
      const ids = clusterByPixel(points, zoom).flatMap((c) =>
        c.items.map((i) => i.id),
      );
      expect(ids).toHaveLength(points.length);
      expect(new Set(ids).size).toBe(points.length);
    }
  });

  it("sits a cluster at the mean of its members, not on whichever seeded it", () => {
    const [cluster] = clusterByPixel([north("a", 0), north("b", 40)], 14);
    expect(cluster.items).toHaveLength(2);
    const expected = (cluster.items[0].lat + cluster.items[1].lat) / 2;
    expect(cluster.lat).toBeCloseTo(expected, 9);
  });

  it("leaves a lone point exactly where it is", () => {
    const point = at("a", 46.5218, 6.6327);
    const [cluster] = clusterByPixel([point], 14);
    expect(cluster.lat).toBe(point.lat);
    expect(cluster.lng).toBe(point.lng);
  });

  it("gives each cluster a stable key from its seed", () => {
    const points = [north("a", 0), north("b", 20)];
    expect(clusterByPixel(points, 14)[0].key).toBe("a");
    // Same input, same key — so React and Leaflet keep the marker alive.
    expect(clusterByPixel(points, 14)[0].key).toBe("a");
  });

  it("honours a custom radius", () => {
    const points = [north("a", 0), north("b", 200)];
    expect(clusterByPixel(points, 14, 4)).toHaveLength(2);
    expect(clusterByPixel(points, 14, 400)).toHaveLength(1);
  });

  it("handles an empty list", () => {
    expect(clusterByPixel([], 14)).toEqual([]);
  });

  it("uses a radius in the region where pins actually collide", () => {
    // A sanity check on the constant: two pins one radius apart must group,
    // and two at three radii must not, at a typical city zoom.
    expect(CLUSTER_RADIUS_PX).toBeGreaterThan(20);
    expect(CLUSTER_RADIUS_PX).toBeLessThan(80);
  });
});

describe("clusterBounds", () => {
  it("spans every member", () => {
    const [cluster] = clusterByPixel(
      [at("a", 46.50, 6.60), at("b", 46.501, 6.601), at("c", 46.502, 6.599)],
      13,
    );
    const [[minLat, minLng], [maxLat, maxLng]] = clusterBounds(cluster);
    expect(minLat).toBeCloseTo(46.5, 5);
    expect(maxLat).toBeCloseTo(46.502, 5);
    expect(minLng).toBeCloseTo(6.599, 5);
    expect(maxLng).toBeCloseTo(6.601, 5);
  });

  it("degenerates to a point for a single-member cluster", () => {
    const [cluster] = clusterByPixel([at("a", 46.52, 6.63)], 14);
    const [min, max] = clusterBounds(cluster);
    expect(min).toEqual(max);
  });
});
