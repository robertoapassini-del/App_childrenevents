import { NextResponse } from "next/server";
import { getActivity } from "@/lib/activities";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const activity = await getActivity(id);

  if (!activity) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ activity });
}
