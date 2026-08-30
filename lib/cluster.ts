import type { LatLng } from "./geo";

/**
 * Screen-space pin clustering.
 *
 * Central Lausanne puts a dozen activities inside a few hundred metres, which at
 * city zoom stacks them into one unreadable clump where the top pin wins every
 * tap. Grouping is done in *pixels*, not metres, because the thing being fixed is
 * visual overlap: two pins 200 m apart collide at zoom 12 and are comfortably
 * separate at zoom 16, and a metre-based threshold cannot express that.
 *
 * Deliberately not a library — this is a single pass over at most a few hundred
 * points, and react-leaflet-cluster would add a dependency with its own React 19
 * compatibility to track.
 */

export interface Clusterable extends LatLng {
  id: string;
}

export interface Cluster<T extends Clusterable> {
  /** Stable across renders so React and Leaflet can keep markers alive. */
  key: string;
  lat: number;
  lng: number;
  items: T[];
}

/** Pixels between pin centres below which two pins are treated as overlapping. */
export const CLUSTER_RADIUS_PX = 44;

/** Web-Mercator world size in pixels at a given zoom, for 256px tiles. */
function worldSize(zoom: number): number {
  return 256 * 2 ** zoom;
}

/** Project to pixel space at `zoom` — the same maths Leaflet uses internally. */
function project(point: LatLng, zoom: number): { x: number; y: number } {
  const size = worldSize(zoom);
  const sinLat = Math.sin((point.lat * Math.PI) / 180);
  return {
    x: size * (point.lng / 360 + 0.5),
    y:
      size *
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)),
  };
}

/**
 * Greedy single-pass clustering: walk the points in order, and put each one into
 * the first existing cluster whose centre it overlaps, else start a new cluster.
 *
 * Greedy means the result depends on input order, which is fine and in fact
 * useful — callers pass activities already sorted by what's happening soonest, so
 * the most relevant activity seeds each cluster and lends it its position.
 */
export function clusterByPixel<T extends Clusterable>(
  points: readonly T[],
  zoom: number,
  radiusPx: number = CLUSTER_RADIUS_PX,
): Cluster<T>[] {
  const clusters: (Cluster<T> & { cx: number; cy: number })[] = [];
  const radiusSq = radiusPx * radiusPx;

  for (const point of points) {
    const projected = project(point, zoom);

    let placed = false;
    for (const cluster of clusters) {
      const dx = cluster.cx - projected.x;
      const dy = cluster.cy - projected.y;
      if (dx * dx + dy * dy <= radiusSq) {
        cluster.items.push(point);
        placed = true;
        break;
      }
    }

    if (!placed) {
      clusters.push({
        key: point.id,
        lat: point.lat,
        lng: point.lng,
        cx: projected.x,
        cy: projected.y,
        items: [point],
      });
    }
  }

  // Sit each cluster at the mean of its members so the marker doesn't cling to
  // whichever activity happened to seed it.
  return clusters.map(({ cx: _cx, cy: _cy, ...cluster }) => {
    if (cluster.items.length === 1) return cluster;
    const lat =
      cluster.items.reduce((sum, p) => sum + p.lat, 0) / cluster.items.length;
    const lng =
      cluster.items.reduce((sum, p) => sum + p.lng, 0) / cluster.items.length;
    return { ...cluster, lat, lng };
  });
}

/** Bounding box of a cluster's members, for zooming into it on tap. */
export function clusterBounds<T extends Clusterable>(
  cluster: Cluster<T>,
): [[number, number], [number, number]] {
  const lats = cluster.items.map((p) => p.lat);
  const lngs = cluster.items.map((p) => p.lng);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}
