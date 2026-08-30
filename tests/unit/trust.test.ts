import { describe, expect, it } from "vitest";
import {
  checkCooldown,
  checkProximity,
  isReportFresh,
  PROXIMITY_RADIUS_M,
  REPORT_COOLDOWN_MS,
  resolveVerification,
  shouldCancel,
  TRUST_PER_VERIFIED_REPORT,
  TRUSTED_SUBMITTER_SCORE,
  trustAwardFor,
  type ReportSummary,
} from "@/lib/trust";
import type { ReportKind } from "@/lib/enums";

const VENUE = { lat: 46.5218, lng: 6.6327 };

/** Move north by roughly `meters`; 1° of latitude is about 111 km. */
const northOf = (meters: number) => ({
  lat: VENUE.lat + meters / 111_320,
  lng: VENUE.lng,
});

const report = (
  submitterId: string,
  kind: ReportKind = "STILL_HAPPENING",
  overrides: Partial<ReportSummary> = {},
): ReportSummary => ({
  kind,
  proximityVerified: true,
  submitterId,
  submitterTrustScore: 0,
  ...overrides,
});

describe("checkProximity", () => {
  it("verifies a report from right at the venue", () => {
    const result = checkProximity(VENUE, VENUE);
    expect(result.proximityVerified).toBe(true);
    expect(result.distanceMeters).toBe(0);
  });

  it("verifies a report comfortably inside the radius", () => {
    const result = checkProximity(VENUE, northOf(50));
    expect(result.proximityVerified).toBe(true);
    expect(result.distanceMeters).toBeGreaterThan(45);
    expect(result.distanceMeters).toBeLessThan(55);
  });

  it("rejects a report from beyond the radius", () => {
    const result = checkProximity(VENUE, northOf(250));
    expect(result.proximityVerified).toBe(false);
  });

  it("accepts a report sitting essentially on the boundary", () => {
    const result = checkProximity(VENUE, northOf(PROXIMITY_RADIUS_M - 1));
    expect(result.proximityVerified).toBe(true);
  });

  it("rejects a report just outside the boundary", () => {
    const result = checkProximity(VENUE, northOf(PROXIMITY_RADIUS_M + 5));
    expect(result.proximityVerified).toBe(false);
  });

  it("records a coordless report without verifying it", () => {
    const result = checkProximity(VENUE, null);
    expect(result).toEqual({ distanceMeters: null, proximityVerified: false });
  });

  it("ignores garbage coordinates rather than trusting them", () => {
    const result = checkProximity(VENUE, { lat: Number.NaN, lng: 6.63 });
    expect(result.proximityVerified).toBe(false);
    expect(result.distanceMeters).toBeNull();
  });
});

describe("trustAwardFor", () => {
  it("rewards a verified report", () => {
    expect(trustAwardFor({ distanceMeters: 10, proximityVerified: true })).toBe(
      TRUST_PER_VERIFIED_REPORT,
    );
  });

  it("gives nothing for a report made from elsewhere", () => {
    expect(trustAwardFor({ distanceMeters: 900, proximityVerified: false })).toBe(0);
  });
});

describe("resolveVerification", () => {
  it("leaves an unverified activity alone with a single report", () => {
    expect(resolveVerification("UNVERIFIED", [report("a")])).toBe("UNVERIFIED");
  });

  it("promotes on two reports from different people", () => {
    expect(resolveVerification("UNVERIFIED", [report("a"), report("b")])).toBe(
      "COMMUNITY_VERIFIED",
    );
  });

  it("does not promote on two reports from the same person", () => {
    expect(resolveVerification("UNVERIFIED", [report("a"), report("a")])).toBe(
      "UNVERIFIED",
    );
  });

  it("does not count reports made away from the venue", () => {
    const remote = [
      report("a", "STILL_HAPPENING", { proximityVerified: false }),
      report("b", "STILL_HAPPENING", { proximityVerified: false }),
    ];
    expect(resolveVerification("UNVERIFIED", remote)).toBe("UNVERIFIED");
  });

  it("accepts one report from an established reporter", () => {
    const trusted = [
      report("a", "STILL_HAPPENING", {
        submitterTrustScore: TRUSTED_SUBMITTER_SCORE,
      }),
    ];
    expect(resolveVerification("UNVERIFIED", trusted)).toBe("COMMUNITY_VERIFIED");
  });

  it("counts a crowded report as confirmation that it's happening", () => {
    expect(
      resolveVerification("UNVERIFIED", [
        report("a", "CROWDED"),
        report("b", "CROWDED"),
      ]),
    ).toBe("COMMUNITY_VERIFIED");
  });

  it("does not treat cancellations as confirmation", () => {
    expect(
      resolveVerification("UNVERIFIED", [
        report("a", "CANCELLED"),
        report("b", "CANCELLED"),
      ]),
    ).toBe("UNVERIFIED");
  });

  it("never overwrites an official listing", () => {
    expect(resolveVerification("OFFICIAL", [report("a"), report("b")])).toBe(
      "OFFICIAL",
    );
  });

  it("never downgrades an already-verified activity", () => {
    expect(resolveVerification("COMMUNITY_VERIFIED", [])).toBe(
      "COMMUNITY_VERIFIED",
    );
  });
});

describe("shouldCancel", () => {
  it("needs two people who were actually there", () => {
    expect(shouldCancel([report("a", "CANCELLED"), report("b", "CANCELLED")])).toBe(
      true,
    );
  });

  it("ignores a lone cancellation", () => {
    expect(shouldCancel([report("a", "CANCELLED")])).toBe(false);
  });

  it("ignores repeat cancellations from one person", () => {
    expect(shouldCancel([report("a", "CANCELLED"), report("a", "CANCELLED")])).toBe(
      false,
    );
  });

  it("refuses to cancel on a trusted reporter alone — hiding a real event is worse", () => {
    const trusted = [
      report("a", "CANCELLED", { submitterTrustScore: TRUSTED_SUBMITTER_SCORE * 5 }),
    ];
    expect(shouldCancel(trusted)).toBe(false);
  });

  it("ignores cancellations reported from elsewhere", () => {
    const remote = [
      report("a", "CANCELLED", { proximityVerified: false }),
      report("b", "CANCELLED", { proximityVerified: false }),
    ];
    expect(shouldCancel(remote)).toBe(false);
  });
});

describe("checkCooldown", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");

  it("allows a first report", () => {
    expect(checkCooldown(null, now)).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it("blocks a repeat inside the window and says how long to wait", () => {
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const result = checkCooldown(tenMinutesAgo, now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(REPORT_COOLDOWN_MS - 10 * 60 * 1000);
  });

  it("allows a repeat once the window has passed", () => {
    const longAgo = new Date(now.getTime() - REPORT_COOLDOWN_MS - 1);
    expect(checkCooldown(longAgo, now).allowed).toBe(true);
  });

  it("allows a repeat exactly at the boundary", () => {
    const exactly = new Date(now.getTime() - REPORT_COOLDOWN_MS);
    expect(checkCooldown(exactly, now).allowed).toBe(true);
  });
});

describe("isReportFresh", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");

  it("counts a recent report as fresh", () => {
    expect(
      isReportFresh({ createdAt: new Date(now.getTime() - 20 * 60_000) }, now),
    ).toBe(true);
  });

  it("counts an old report as stale", () => {
    expect(
      isReportFresh({ createdAt: new Date(now.getTime() - 5 * 3_600_000) }, now),
    ).toBe(false);
  });
});
