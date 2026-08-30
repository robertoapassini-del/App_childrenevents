"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getAgeGroup } from "@/lib/age";
import { clusterBounds, clusterByPixel, type Cluster } from "@/lib/cluster";
import { LAUSANNE_CENTER } from "@/lib/geo";
import { useI18n } from "@/lib/i18n/context";
import type { ActivityDTO } from "@/lib/activities";
import { ageIconMarkup } from "./icons";

const DEFAULT_ZOOM = 14;

/**
 * The pin carries three facts at a glance: which age group it's for (colour plus
 * a shape, so the coding survives colourblindness), whether it's indoors or out
 * (the ring), and whether it's been cancelled. An activity spanning several age
 * groups takes the colour of the youngest — that's the parent with the least
 * flexibility about where they can go.
 */
function pinFor(activity: ActivityDTO, selected: boolean): L.DivIcon {
  const group = getAgeGroup(activity.ageGroups[0] ?? "toddler");
  const cancelled = activity.status === "CANCELLED";
  const ring = activity.effectiveSetting === "OUTDOOR" ? "#2fa36b" : "#ffffff";
  const size = selected ? 40 : 32;

  const mark = cancelled
    ? `<svg viewBox="0 0 24 24" width="${size / 2}" height="${size / 2}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg>`
    : ageIconMarkup(group.icon, size / 2);

  // No stray whitespace in the template: the marker's text content is asserted
  // on, and an indented template would pad it with newlines.
  return L.divIcon({
    className: "ouistiti-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html:
      `<span style="display:grid;place-items:center;` +
      `width:${size}px;height:${size}px;border-radius:9999px;` +
      `background:${cancelled ? "#a19085" : group.colorHex};` +
      `border:3px solid ${ring};box-shadow:0 2px 6px rgba(42,31,26,.35);` +
      `color:#fff;opacity:${cancelled ? 0.65 : 1};">${mark}</span>`,
  });
}

/** A group of overlapping pins, shown as one marker with a count. */
function clusterIcon(count: number, selected: boolean): L.DivIcon {
  const size = selected ? 46 : 40;
  return L.divIcon({
    className: "ouistiti-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html:
      `<span style="display:grid;place-items:center;` +
      `width:${size}px;height:${size}px;border-radius:9999px;` +
      `background:#a94e02;border:3px solid #ffffff;` +
      `box-shadow:0 2px 8px rgba(42,31,26,.4);color:#fff;` +
      `font-size:${size > 42 ? 15 : 13}px;font-weight:800;font-family:inherit;` +
      `">${count}</span>`,
  });
}

/** Keeps the map centred on the selected activity and on "near me" requests. */
function MapController({
  focus,
}: {
  focus: { lat: number; lng: number; zoom?: number } | null;
}) {
  const map = useMap();
  const lastFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!focus) return;
    const key = `${focus.lat},${focus.lng},${focus.zoom ?? ""}`;
    if (key === lastFocus.current) return;
    lastFocus.current = key;
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? map.getZoom(), {
      duration: 0.6,
    });
  }, [focus, map]);

  return null;
}

/** Reports the zoom, since clustering is a function of it. */
function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  return null;
}

export interface ActivityMapProps {
  activities: ActivityDTO[];
  selectedId: string | null;
  onSelect: (activity: ActivityDTO) => void;
  focus: { lat: number; lng: number; zoom?: number } | null;
  userPosition: { lat: number; lng: number } | null;
}

function ClusterMarkers({
  clusters,
  selectedId,
  onSelect,
}: {
  clusters: Cluster<ActivityDTO & { id: string }>[];
  selectedId: string | null;
  onSelect: (activity: ActivityDTO) => void;
}) {
  const map = useMap();

  return (
    <>
      {clusters.map((cluster) => {
        const holdsSelection = cluster.items.some((a) => a.id === selectedId);

        if (cluster.items.length === 1) {
          const activity = cluster.items[0]!;
          return (
            <Marker
              key={cluster.key}
              position={[activity.lat, activity.lng]}
              icon={pinFor(activity, activity.id === selectedId)}
              zIndexOffset={activity.id === selectedId ? 1000 : 0}
              eventHandlers={{ click: () => onSelect(activity) }}
            />
          );
        }

        return (
          <Marker
            key={cluster.key}
            position={[cluster.lat, cluster.lng]}
            icon={clusterIcon(cluster.items.length, holdsSelection)}
            zIndexOffset={holdsSelection ? 900 : 0}
            eventHandlers={{
              // Zoom to fit the group rather than picking one of them for the
              // parent — they tapped a number, not an activity.
              click: () =>
                map.flyToBounds(clusterBounds(cluster), {
                  padding: [56, 56],
                  maxZoom: 17,
                  duration: 0.5,
                }),
            }}
          />
        );
      })}
    </>
  );
}

export default function ActivityMap({
  activities,
  selectedId,
  onSelect,
  focus,
  userPosition,
}: ActivityMapProps) {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const clusters = useMemo(
    () => clusterByPixel(activities, zoom),
    [activities, zoom],
  );

  const userIcon = useMemo(
    () =>
      L.divIcon({
        className: "ouistiti-me",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: `<span style="
          display:block;width:18px;height:18px;border-radius:9999px;
          background:#2e86c1;border:3px solid #fff;
          box-shadow:0 0 0 4px rgba(46,134,193,.25);
        "></span>`,
      }),
    [],
  );

  return (
    <MapContainer
      center={[LAUSANNE_CENTER.lat, LAUSANNE_CENTER.lng]}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
      aria-label={t.a11y.mapLabel}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />

      <MapController focus={focus} />
      <ZoomWatcher onZoom={setZoom} />

      <ClusterMarkers
        clusters={clusters}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      {userPosition ? (
        <Marker
          position={[userPosition.lat, userPosition.lng]}
          icon={userIcon}
          interactive={false}
        />
      ) : null}
    </MapContainer>
  );
}
