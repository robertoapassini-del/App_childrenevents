import { NextResponse, type NextRequest } from "next/server";
import { WeatherQuery } from "@/lib/schemas";
import { getWeather } from "@/lib/services/weather";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = WeatherQuery.safeParse({
    lat: params.get("lat"),
    lng: params.get("lng"),
    at: params.get("at") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { lat, lng, at } = parsed.data;
  const weather = await getWeather({ lat, lng }, at ?? new Date());

  // A missing forecast is a normal outcome, not an error — the UI just omits it.
  return NextResponse.json({ weather });
}
