import { NextResponse } from "next/server";
import { ingestLink } from "@/lib/ingest";
import { IngestLinkInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";
// The chain fetches a page and may call the model; give it room.
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = IngestLinkInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  const result = await ingestLink(parsed.data.url);

  // NEEDS_TEXT is a normal outcome, not a failure — the UI turns it into
  // "paste the event text instead", so it answers 200 with the reason.
  return NextResponse.json(result);
}
