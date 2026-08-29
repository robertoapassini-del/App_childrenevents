import type { Metadata, Viewport } from "next";
import { getLocale } from "@/lib/locale-server";
import { getDictionary, localeTag } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/context";
import { RegisterServiceWorker } from "./register-sw";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Ouistiti — où sortir avec les petits",
    template: "%s · Ouistiti",
  },
  description:
    "La carte des sorties, activités et places de jeux pour les 0–5 ans à Lausanne. Sans compte, sans application à installer.",
  applicationName: "Ouistiti",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Ouistiti",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "Ouistiti",
    title: "Ouistiti — où sortir avec les petits",
    description:
      "La carte des sorties et places de jeux pour les 0–5 ans à Lausanne.",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2820d",
  width: "device-width",
  initialScale: 1,
  // The map needs pinch-zoom; capping it at 5 keeps that without letting a
  // stray double-tap throw the layout off entirely.
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <html lang={localeTag(locale)}>
      <body className="min-h-full antialiased">
        <I18nProvider locale={locale}>
          <a
            href="#main"
            className="sr-only rounded-full bg-ouistiti-500 px-4 py-2 font-bold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[2000]"
          >
            {t.a11y.mapLabel}
          </a>
          {children}
        </I18nProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
