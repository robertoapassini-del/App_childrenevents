import type { SVGProps } from "react";
import type { AgeGroupId } from "@/lib/enums";
import type { WeatherIcon } from "@/lib/weather";

/**
 * Every mark in the interface, as inline SVG.
 *
 * These were text characters — ◍ ▲ ◆ ☂ ⌂ ✋ — which was a mistake. Those are
 * font-dependent: several render as colour emoji on Android and as tofu boxes
 * where the font lacks them. That breaks the age coding precisely where it
 * matters, since colour-plus-glyph is what makes it survive colourblindness.
 * A path always draws.
 *
 * All of them inherit `currentColor` and size to `1em`, so they sit in text the
 * way a character did.
 */

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative unless given a title; the visible label carries the meaning.
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

// --- Age groups ---------------------------------------------------------------
//
// Three shapes that stay distinct at 12px and share no silhouette: a ring, a
// triangle, a diamond. Defined as raw path data because the map pin needs the
// same marks as an HTML string for Leaflet's divIcon.

/**
 * Path data, not elements, because the map pin needs the same three marks as an
 * HTML string for Leaflet's divIcon — so both consumers read from here and the
 * pin can never drift from the badge.
 */
export const AGE_ICON_PATHS: Record<AgeGroupId, string[]> = {
  infant: ["M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z", "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"],
  toddler: ["M12 4.5 20 19H4Z"],
  preschool: ["M12 3.5 20.5 12 12 20.5 3.5 12Z"],
};

/** The mark as standalone SVG markup, for Leaflet's HTML-string icons. */
export function ageIconMarkup(id: AgeGroupId, size: number): string {
  const paths = AGE_ICON_PATHS[id]
    .map((d) => `<path d="${d}" />`)
    .join("");
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export function AgeIcon({ id, ...props }: IconProps & { id: AgeGroupId }) {
  return (
    <Svg {...props} strokeWidth={2.4}>
      {AGE_ICON_PATHS[id].map((d) => (
        <path key={d} d={d} />
      ))}
    </Svg>
  );
}

// --- Weather ------------------------------------------------------------------

const CLOUD = "M7 18h9.5a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.5 1A3.5 3.5 0 0 0 7 18Z";

const SUN_RAYS = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </>
);

const WEATHER_MARKS: Record<WeatherIcon, React.ReactNode> = {
  clear: SUN_RAYS,
  partly: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M8.5 2.5v1.5M3 8h1.5M4.6 4.1 5.7 5.2M12.4 4.1 11.3 5.2" />
      <path d={CLOUD} />
    </>
  ),
  cloudy: <path d={CLOUD} />,
  fog: (
    <>
      <path d="M6 14h12M4 18h11M8 10h10" />
      <path d="M7 6h10" />
    </>
  ),
  drizzle: (
    <>
      <path d={CLOUD} />
      <path d="M10 20.5v1M14 20.5v1" />
    </>
  ),
  rain: (
    <>
      <path d={CLOUD} />
      <path d="M9 20v2M13 20v2M17 20v2" />
    </>
  ),
  snow: (
    <>
      <path d={CLOUD} />
      <path d="M9.5 21h.01M13 21h.01M16.5 21h.01" strokeWidth={2.6} />
    </>
  ),
  thunder: (
    <>
      <path d={CLOUD} />
      <path d="m13 20-3.5 4h4L10 24" />
      <path d="M13.5 19.5 11 23h3l-1.5 2.5" />
    </>
  ),
};

export function WeatherGlyph({ icon, ...props }: IconProps & { icon: WeatherIcon }) {
  return <Svg {...props}>{WEATHER_MARKS[icon]}</Svg>;
}

// --- Indoor / outdoor ---------------------------------------------------------

export function IndoorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6.5 9.5V20h11V9.5" />
    </Svg>
  );
}

/**
 * A pine, drawn as two stacked triangles. A round canopy was tried first and
 * read as a balloon on a stick at badge size — the silhouette has to be
 * unmistakable at 14px, and nothing else in the set is triangular-stacked.
 */
export function OutdoorIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 7 11h10Z" />
      <path d="M12 9.5 5 19h14Z" />
      <path d="M12 19v2.5" />
    </Svg>
  );
}

// --- Trust badges -------------------------------------------------------------

export function OfficialIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9Z" />
    </Svg>
  );
}

export function VerifiedIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Svg>
  );
}

export function UnverifiedIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 1-1 1.7v.5" />
      <path d="M12 18h.01" strokeWidth={2.6} />
    </Svg>
  );
}

// --- Status buttons -----------------------------------------------------------

/** "Ça a lieu" — a tick, which reads faster than the raised hand it replaces. */
export function HappeningIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Svg>
  );
}

/** "C'est plein" — a crowd. */
export function CrowdedIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8.5" r="2.8" />
      <circle cx="16.5" cy="9.5" r="2.2" />
      <path d="M3 19c0-2.8 2.2-4.8 5-4.8s5 2 5 4.8" />
      <path d="M14.5 19c0-2.2 1.4-3.8 3.3-3.8 1.7 0 3.2 1.3 3.2 3.3" />
    </Svg>
  );
}

export function CancelledIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6 18 18M18 6 6 18" />
    </Svg>
  );
}

// --- Interface ----------------------------------------------------------------

export function NearMeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </Svg>
  );
}

export function DirectionsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15V4" />
      <path d="m8 7.5 4-3.5 4 3.5" />
      <path d="M5.5 13v6.5h13V13" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6 18 18M18 6 6 18" />
    </Svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}
