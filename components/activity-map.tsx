"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getAgeGroup } from "@/lib/age";
import { LAUSANNE_CENTER } from "@/lib/geo";
import { useI18n } from "@/lib/i18n/context";
import type { ActivityDTO } from "@/lib/activities";

/**
 * The pin carries three facts at a glance: which age group it's for (colour plus
 * a glyph, so the coding survives colourblindness), whether it's indoors or out
 * (the ring), and whether it's been cancelled. An activity spanning several age
 * groups takes the colour of the youngest — that's the parent with the least
 * flexibility about where they can go.
 */
function pinFor(activity: ActivityDTO, selected: boolean): L.DivIcon {
  const group = getAgeGroup(activity.ageGroups[0] ?? "toddler");
  const cancelled = activity.status === "CANCELLED";
  const ring = activity.effectiveSetting === "OUTDOOR" ? "#2fa36b" : "#ffffff";
  const size = selected ? 40 : 32;

  return L.divIcon({
    className: "ouistiti-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <span style="
        display:grid;place-items:center;
        width:${size}px;height:${size}px;
        border-radius:9999px;
        background:${cancelled ? "#a19085" : group.colorVar};
        border:3px solid ${ring};
        box-shadow:0 2px 6px rgba(42,31,26,.35);
        color:#fff;font-size:${selected ? 16 : 13}px;font-weight:700;
        opacity:${cancelled ? 0.65 : 1};
        transition:width .12s ease,height .12s ease;
      ">${cancelled ? "✕" : group.glyph}</span>
    `,
  });
}

/** Keeps the map centred on the selected activity and on "near me" requests. */
function MapController({
  focus,
  onBoundsChange,
}: {
  focus: { lat: number; lng: number; zoom?: number } | null;
  onBoundsChange?: (bbox: string) => void;
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

  useEffect(() => {
    if (!onBoundsChange) return;
    const emit = () => {
      const b = map.getBounds();
      onBoundsChange(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
          .map((n) => n.toFixed(5))
          .join(","),
      );
    };
    map.on("moveend", emit);
    return () => {
      map.off("moveend", emit);
    };
  }, [map, onBoundsChange]);

  return null;
}

export interface ActivityMapProps {
  activities: ActivityDTO[];
  selectedId: string | null;
  onSelect: (activity: ActivityDTO) => void;
  focus: { lat: number; lng: number; zoom?: number } | null;
  userPosition: { lat: number; lng: number } | null;
}

export default function ActivityMap({
  activities,
  selectedId,
  onSelect,
  focus,
  userPosition,
}: ActivityMapProps) {
  const { t } = useI18n();

  const markers = useMemo(
    () =>
      activities.map((activity) => ({
        activity,
        icon: pinFor(activity, activity.id === selectedId),
      })),
    [activities, selectedId],
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
      zoom={14}
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

      {markers.map(({ activity, icon }) => (
        <Marker
          key={activity.id}
          position={[activity.lat, activity.lng]}
          icon={icon}
          zIndexOffset={activity.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(activity) }}
        />
      ))}

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
