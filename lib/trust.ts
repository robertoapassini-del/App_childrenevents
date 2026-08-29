import { haversineMeters, type LatLng } from "./geo";
import type { ReportKind, Verification } from "./enums";

/**
 * The trust system, with no I/O so it can be reasoned about and tested directly.
 *
 * The premise: a parent standing in front of the thing is the only cheap source of
 * truth we have. Being physically there is the credential — not an account, not a
 * reputation built elsewhere. Everything here follows from that.
 */

/** Close enough to be standing at the activity. GPS drift in a city is ~20–50 m. */
export const PROXIMITY_RADIUS_M = 100;

/** Trust earned per verified report. */
export const TRUST_PER_VERIFIED_REPORT = 2;

/** At this score, one report from this person is enough to verify an activity. */
export const TRUSTED_SUBMITTER_SCORE = 10;

/** Reports from distinct people needed to verify, or to cancel, an activity. */
export const REPORTS_TO_VERIFY = 2;
export const REPORTS_TO_CANCEL = 2;

/** One report per person per activity per this long. */
export const REPORT_COOLDOWN_MS = 30 * 60 * 1000;

export interface ProximityCheck {
  distanceMeters: number | null;
  proximityVerified: boolean;
}

/**
 * Was this report made at the activity? A report without coordinates is still
 * recorded — it's a useful signal to other parents — but it earns no trust and
 * cannot verify or cancel anything.
 */
export function checkProximity(
  activity: LatLng,
  reportedFrom: LatLng | null | undefined,
): ProximityCheck {
  if (
    !reportedFrom ||
    !Number.isFinite(reportedFrom.lat) ||
    !Number.isFinite(reportedFrom.lng)
  ) {
    return { distanceMeters: null, proximityVerified: false };
  }

  const distanceMeters = haversineMeters(activity, reportedFrom);
  return {
    distanceMeters,
    proximityVerified: distanceMeters <= PROXIMITY_RADIUS_M,
  };
}

export function trustAwardFor(check: ProximityCheck): number {
  return check.proximityVerified ? TRUST_PER_VERIFIED_REPORT : 0;
}

export interface ReportSummary {
  kind: ReportKind;
  proximityVerified: boolean;
  submitterId: string;
  /** The reporter's score *before* this report — used for the trusted shortcut. */
  submitterTrustScore: number;
}

function distinctVerifiedSubmitters(
  reports: readonly ReportSummary[],
  kinds: readonly ReportKind[],
): Set<string> {
  const ids = new Set<string>();
  for (const r of reports) {
    if (r.proximityVerified && kinds.includes(r.kind)) ids.add(r.submitterId);
  }
  return ids;
}

function hasTrustedWitness(
  reports: readonly ReportSummary[],
  kinds: readonly ReportKind[],
): boolean {
  return reports.some(
    (r) =>
      r.proximityVerified &&
      kinds.includes(r.kind) &&
      r.submitterTrustScore >= TRUSTED_SUBMITTER_SCORE,
  );
}

/**
 * The verification badge an activity should now carry.
 *
 * OFFICIAL is a statement about where the listing came from, not about who has
 * confirmed it, so community reports never overwrite it — and never downgrade an
 * activity either. Verification only ever moves up.
 */
export function resolveVerification(
  current: Verification,
  reports: readonly ReportSummary[],
): Verification {
  if (current === "OFFICIAL") return "OFFICIAL";

  const kinds: ReportKind[] = ["STILL_HAPPENING", "CROWDED"];
  const witnesses = distinctVerifiedSubmitters(reports, kinds);

  if (witnesses.size >= REPORTS_TO_VERIFY || hasTrustedWitness(reports, kinds)) {
    return "COMMUNITY_VERIFIED";
  }

  return current;
}

/**
 * Should this activity be marked cancelled?
 *
 * Deliberately stricter than verification: wrongly hiding something a family is
 * already on a bus towards is worse than showing something that turns out to be
 * over. So a single trusted reporter is *not* enough here — cancelling always
 * needs two people who were actually there.
 */
export function shouldCancel(reports: readonly ReportSummary[]): boolean {
  const witnesses = distinctVerifiedSubmitters(reports, ["CANCELLED"]);
  return witnesses.size >= REPORTS_TO_CANCEL;
}

export interface CooldownCheck {
  allowed: boolean;
  retryAfterMs: number;
}

/** Rate limit: one report per person per activity per REPORT_COOLDOWN_MS. */
export function checkCooldown(
  lastReportAt: Date | null | undefined,
  now: Date,
): CooldownCheck {
  if (!lastReportAt) return { allowed: true, retryAfterMs: 0 };

  const elapsed = now.getTime() - lastReportAt.getTime();
  if (elapsed >= REPORT_COOLDOWN_MS) return { allowed: true, retryAfterMs: 0 };

  return { allowed: false, retryAfterMs: REPORT_COOLDOWN_MS - elapsed };
}

/** How fresh a status report is, for the "seen 10 min ago" line on the card. */
export function isReportFresh(
  report: { createdAt: Date },
  now: Date,
  windowMs = 3 * 60 * 60 * 1000,
): boolean {
  return now.getTime() - report.createdAt.getTime() <= windowMs;
}
