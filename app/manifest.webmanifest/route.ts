import { NextResponse } from "next/server";

/**
 * Served from a route handler rather than a static file so the icons and the
 * theme colour stay in one place with the rest of the app config.
 *
 * `display: standalone` plus the maskable icon is what makes "Add to home
 * screen" produce something that looks like an app — which is the whole
 * substitute for an App Store presence.
 */
export function GET() {
  return NextResponse.json(
    {
      name: "Ouistiti — où sortir avec les petits",
      short_name: "Ouistiti",
      description:
        "La carte des sorties, activités et places de jeux pour les 0–5 ans à Lausanne.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#fff8f0",
      theme_color: "#f2820d",
      lang: "fr-CH",
      categories: ["lifestyle", "travel", "social"],
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
      shortcuts: [
        {
          name: "Aujourd'hui",
          url: "/?when=today",
        },
        {
          name: "Ce week-end",
          url: "/?when=weekend",
        },
        {
          name: "Ajouter une sortie",
          url: "/ajouter",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
