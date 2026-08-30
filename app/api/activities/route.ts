import { NextResponse, type NextRequest } from "next/server";
import { listActivities } from "@/lib/activities";
import { ActivityQuery, ActivityInput } from "@/lib/schemas";
import { prisma } from "@/lib/db";
import { geocode } from "@/lib/services/geocode";
import { getOrCreateSubmitter } from "@/lib/submitter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = ActivityQuery.safeParse({
    bbox: params.get("bbox") ?? undefined,
    age: params.get("age") ?? undefined,
    setting: params.get("setting") ?? undefined,
    when: params.get("when") ?? undefined,
    kind: params.get("kind") ?? undefined,
    q: params.get("q") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const activities = await listActivities(parsed.data);
  return NextResponse.json({ activities });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ActivityInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_activity", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Coordinates are what put it on the map, so fall back to geocoding the address
  // when the submitter didn't drop a pin themselves.
  let lat = input.lat;
  let lng = input.lng;
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    const located = await geocode({
      address: input.address,
      postalCode: input.postalCode,
      city: input.city,
    });
    if (!located) {
      return NextResponse.json(
        { error: "geocode_failed", field: "address" },
        { status: 422 },
      );
    }
    lat = located.lat;
    lng = located.lng;
  }

  const submitter = await getOrCreateSubmitter();

  const created = await prisma.activity.create({
    data: {
      kind: input.kind,
      title: input.title,
      titleEn: input.titleEn ?? null,
      description: input.description ?? null,
      descriptionEn: input.descriptionEn ?? null,
      venueName: input.venueName,
      address: input.address,
      city: input.city,
      postalCode: input.postalCode ?? null,
      lat,
      lng,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      weeklyHours: input.weeklyHours ? JSON.stringify(input.weeklyHours) : null,
      alwaysOpen: input.alwaysOpen,
      ageMinMonths: input.ageMinMonths,
      ageMaxMonths: input.ageMaxMonths,
      priceCents: input.isFree ? 0 : (input.priceCents ?? null),
      isFree: input.isFree || input.priceCents === 0,
      dropIn: input.dropIn,
      setting: input.setting,
      // Anything a parent submits starts unverified, whatever it claims about
      // itself. OFFICIAL is only ever set by us, never by a submission.
      verification: "UNVERIFIED",
      status: "ACTIVE",
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      submitterId: submitter.id,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
