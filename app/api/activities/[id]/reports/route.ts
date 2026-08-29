import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ReportInput } from "@/lib/schemas";
import { getOrCreateSubmitter } from "@/lib/submitter";
import {
  checkCooldown,
  checkProximity,
  resolveVerification,
  shouldCancel,
  trustAwardFor,
  type ReportSummary,
} from "@/lib/trust";
import type { ReportKind, Verification } from "@/lib/enums";

export const dynamic = "force-dynamic";

/**
 * The 1-tap status button. This is the only write path where being physically
 * present matters, so it's where lib/trust's rules are applied.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ReportInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_report", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity || activity.status === "HIDDEN") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const submitter = await getOrCreateSubmitter();

  // One report per person per activity per cooldown window.
  const previous = await prisma.statusReport.findFirst({
    where: { activityId: id, submitterId: submitter.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const cooldown = checkCooldown(previous?.createdAt ?? null, new Date());
  if (!cooldown.allowed) {
    return NextResponse.json(
      { error: "too_soon", retryAfterMs: cooldown.retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(cooldown.retryAfterMs / 1000)) },
      },
    );
  }

  const proximity = checkProximity(
    { lat: activity.lat, lng: activity.lng },
    input.lat != null && input.lng != null
      ? { lat: input.lat, lng: input.lng }
      : null,
  );

  // The submitter's score *before* this report is what decides whether their word
  // alone can verify the listing — a report can't bootstrap its own authority.
  const trustScoreBefore = submitter.trustScore;

  const [, updatedSubmitter] = await prisma.$transaction([
    prisma.statusReport.create({
      data: {
        activityId: id,
        kind: input.kind,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        distanceMeters: proximity.distanceMeters,
        proximityVerified: proximity.proximityVerified,
        submitterId: submitter.id,
      },
    }),
    prisma.submitter.update({
      where: { id: submitter.id },
      data: {
        trustScore: { increment: trustAwardFor(proximity) },
        verifiedReports: {
          increment: proximity.proximityVerified ? 1 : 0,
        },
      },
    }),
  ]);

  // Re-read the recent reports and let lib/trust decide what the activity is now.
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const recent = await prisma.statusReport.findMany({
    where: { activityId: id, createdAt: { gte: since } },
    include: { submitter: { select: { trustScore: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const summaries: ReportSummary[] = recent.map((r) => ({
    kind: r.kind as ReportKind,
    proximityVerified: r.proximityVerified,
    submitterId: r.submitterId,
    // For the report just filed, use the score from before it landed.
    submitterTrustScore:
      r.submitterId === submitter.id ? trustScoreBefore : r.submitter.trustScore,
  }));

  const verification = resolveVerification(
    activity.verification as Verification,
    summaries,
  );
  const cancelled = shouldCancel(summaries);
  const status = cancelled ? "CANCELLED" : activity.status;

  if (verification !== activity.verification || status !== activity.status) {
    await prisma.activity.update({
      where: { id },
      data: { verification, status },
    });
  }

  return NextResponse.json(
    {
      recorded: true,
      proximityVerified: proximity.proximityVerified,
      distanceMeters:
        proximity.distanceMeters === null
          ? null
          : Math.round(proximity.distanceMeters),
      verification,
      status,
      trustScore: updatedSubmitter.trustScore,
      recentReports: recent.length,
    },
    { status: 201 },
  );
}
