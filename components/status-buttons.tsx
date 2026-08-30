"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useGeolocation } from "@/lib/use-geolocation";
import type { ReportKind } from "@/lib/enums";
import type { ActivityDTO } from "@/lib/activities";
import { CancelledIcon, CrowdedIcon, HappeningIcon } from "./icons";

interface ReportResponse {
  recorded: boolean;
  proximityVerified: boolean;
  distanceMeters: number | null;
  verification: ActivityDTO["verification"];
  status: ActivityDTO["status"];
  recentReports: number;
}

type Feedback =
  | { kind: "none" }
  | { kind: "sending" }
  | { kind: "thanks"; verified: boolean }
  | { kind: "tooSoon" }
  | { kind: "failed" };

const BUTTONS: {
  kind: ReportKind;
  Icon: typeof HappeningIcon;
  className: string;
}[] = [
  {
    kind: "STILL_HAPPENING",
    Icon: HappeningIcon,
    className: "border-fern-600 bg-fern-500 text-white hover:bg-fern-600",
  },
  {
    kind: "CROWDED",
    Icon: CrowdedIcon,
    className:
      "border-ouistiti-600 bg-ouistiti-400 text-ouistiti-900 hover:bg-ouistiti-500",
  },
  {
    kind: "CANCELLED",
    Icon: CancelledIcon,
    className: "border-plum-900 bg-plum-700 text-white hover:bg-plum-600",
  },
];

/**
 * The one-tap feedback row. It asks for location because being within 100 m is
 * what makes a report count for verification — but a refused or unavailable fix
 * never blocks the report, it just downgrades what it can prove.
 */
export function StatusButtons({
  activity,
  onUpdated,
}: {
  activity: ActivityDTO;
  onUpdated?: (activity: ActivityDTO) => void;
}) {
  const { t, fmt } = useI18n();
  const geo = useGeolocation();
  const [feedback, setFeedback] = useState<Feedback>({ kind: "none" });

  const labels: Record<ReportKind, string> = {
    STILL_HAPPENING: t.status.stillHappening,
    CROWDED: t.status.crowded,
    CANCELLED: t.status.cancelled,
  };

  async function report(kind: ReportKind) {
    setFeedback({ kind: "sending" });

    // Best effort: if the parent declines, the report still goes.
    const position = await geo.request();

    try {
      const response = await fetch(`/api/activities/${activity.id}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          lat: position?.lat ?? null,
          lng: position?.lng ?? null,
          accuracy: position?.accuracy ?? null,
        }),
      });

      if (response.status === 429) {
        setFeedback({ kind: "tooSoon" });
        return;
      }
      if (!response.ok) {
        setFeedback({ kind: "failed" });
        return;
      }

      const result = (await response.json()) as ReportResponse;
      setFeedback({ kind: "thanks", verified: result.proximityVerified });

      onUpdated?.({
        ...activity,
        verification: result.verification,
        status: result.status,
        recentReports: result.recentReports,
        lastReportAt: new Date().toISOString(),
      });
    } catch {
      setFeedback({ kind: "failed" });
    }
  }

  const sending = feedback.kind === "sending";

  return (
    <section className="rounded-3xl border-2 border-ouistiti-200 bg-ouistiti-50 p-3">
      <h3 className="text-sm font-extrabold text-ink">{t.status.heading}</h3>
      <p className="mt-0.5 text-xs text-ink-soft">{t.status.subheading}</p>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {BUTTONS.map((button) => (
          <button
            key={button.kind}
            type="button"
            disabled={sending}
            onClick={() => report(button.kind)}
            className={`tap flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-2 text-xs leading-tight font-bold transition-transform active:scale-95 disabled:opacity-60 ${button.className}`}
          >
            <button.Icon className="text-lg" />
            {labels[button.kind]}
          </button>
        ))}
      </div>

      <p
        aria-live="polite"
        className="mt-2 min-h-[1.25rem] text-xs font-semibold text-ink-soft"
      >
        {sending
          ? t.status.locating
          : feedback.kind === "thanks"
            ? feedback.verified
              ? t.status.verifiedThanks
              : `${t.status.thanks} ${geo.state.status === "denied" ? t.status.noLocation : ""}`.trim()
            : feedback.kind === "tooSoon"
              ? t.status.tooSoon
              : feedback.kind === "failed"
                ? t.status.failed
                : activity.recentReports > 0
                  ? fmt(
                      activity.recentReports === 1
                        ? t.status.reportCount
                        : t.status.reportCountPlural,
                      { count: activity.recentReports },
                    )
                  : ""}
      </p>
    </section>
  );
}
