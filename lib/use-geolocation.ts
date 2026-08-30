"use client";

import { useCallback, useState } from "react";

export interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

type State =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ready"; position: Position }
  | { status: "denied" }
  | { status: "unavailable" };

/**
 * Location is requested on demand, never on load. A permission prompt in a
 * visitor's face before they've seen anything is exactly the friction this app
 * exists to avoid — so it only fires when someone taps "near me" or files a
 * status report, where the reason for asking is obvious.
 */
export function useGeolocation() {
  const [state, setState] = useState<State>({ status: "idle" });

  const request = useCallback((): Promise<Position | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unavailable" });
      return Promise.resolve(null);
    }

    setState({ status: "locating" });

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (result) => {
          const position: Position = {
            lat: result.coords.latitude,
            lng: result.coords.longitude,
            accuracy: result.coords.accuracy,
          };
          setState({ status: "ready", position });
          resolve(position);
        },
        (error) => {
          setState(
            error.code === error.PERMISSION_DENIED
              ? { status: "denied" }
              : { status: "unavailable" },
          );
          resolve(null);
        },
        {
          // Verification hinges on a 100 m radius, so a cached city-level fix is
          // worse than useless here — it would wrongly verify a listing.
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 30_000,
        },
      );
    });
  }, []);

  return {
    state,
    request,
    position: state.status === "ready" ? state.position : null,
    isLocating: state.status === "locating",
  };
}
