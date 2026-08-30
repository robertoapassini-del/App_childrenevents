"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes Ouistiti installable and keeps the map
 * usable on the flaky connection you get in a Lausanne stairwell. Deliberately
 * dev-excluded: a cached shell fights the hot reloader.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unavailable service worker costs offline support and nothing else.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
