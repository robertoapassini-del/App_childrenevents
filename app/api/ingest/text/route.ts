import { NextResponse } from "next/server";
import { ingestText } from "@/lib/ingest";
import { IngestTextInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = IngestTextInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_text", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await ingestText(parsed.data.text, parsed.data.sourceUrl);
  return NextResponse.json(result);
}
