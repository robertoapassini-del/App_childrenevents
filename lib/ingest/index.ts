import { classifyLink, type LinkKind } from "./classify";
import { extractMetadata, type ExtractedEvent } from "./extract-metadata";
import { fetchPage } from "./fetch-page";
import {
  isParsingAvailable,
  parseEventText,
  type DraftActivity,
} from "./parse-text";
import type { SourceType } from "../enums";

/**
 * The ingestion chain, in the order that costs least:
 *
 *   classify → fetch → JSON-LD (free, instant, done) → OpenGraph + model → ask
 *   for pasted text → manual entry.
 *
 * Every outcome ends somewhere useful. Even total failure returns
 * `NEEDS_TEXT`, which the UI turns into "paste the event text instead" rather
 * than an error the parent can't act on.
 */

export type IngestOutcome =
  | "PARSED"           // a usable draft, from metadata or the model
  | "NEEDS_TEXT"       // couldn't read the page; ask for the text
  | "PARSING_DISABLED"; // no API key, and metadata wasn't enough

export interface IngestResult {
  outcome: IngestOutcome;
  draft: Partial<DraftActivity> | null;
  /** Which fields the parent should look at before saving. */
  checkFields: string[];
  sourceType: SourceType;
  sourceUrl: string | null;
  linkKind: LinkKind;
  /** True when Facebook (or similar) demanded a login. Drives the UI copy. */
  loginWall: boolean;
}

/** Fields the extractor filled in are high confidence; the rest need a look. */
function checkFieldsFor(draft: Partial<DraftActivity>): string[] {
  const fields: string[] = [];
  const confidence = draft.confidence;

  if (!draft.title || confidence?.title === "low") fields.push("title");
  if (confidence?.date === "low" || (draft.kind === "EVENT" && !draft.startsAt)) {
    fields.push("startsAt");
  }
  if (!draft.venueName && !draft.address) fields.push("address");
  else if (confidence?.location === "low") fields.push("address");
  if (confidence?.ages === "low") fields.push("ageRange");

  for (const missing of draft.missing ?? []) {
    if (!fields.includes(missing)) fields.push(missing);
  }
  return fields;
}

/** Turn a complete JSON-LD extraction straight into a draft, no model needed. */
function draftFromMetadata(event: ExtractedEvent): Partial<DraftActivity> {
  return {
    kind: "EVENT",
    title: event.title ?? undefined,
    description: event.description,
    venueName: event.venueName,
    address: event.address,
    postalCode: event.postalCode,
    city: event.city ?? "Lausanne",
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    weeklyHours: null,
    priceCents: event.priceCents,
    isFree: event.isFree ?? event.priceCents === 0,
    // Ages are almost never in a page's structured data, so these are defaults
    // for the parent to correct rather than anything the page told us.
    ageMinMonths: 0,
    ageMaxMonths: 60,
    dropIn: true,
    setting: "INDOOR",
    confidence: {
      title: "high",
      date: "high",
      location: event.address ? "high" : "medium",
      ages: "low",
    },
    missing: ["ageRange"],
  };
}

export async function ingestLink(rawUrl: string): Promise<IngestResult> {
  const link = classifyLink(rawUrl);

  const base = {
    sourceType: link.sourceType,
    sourceUrl: link.url,
    linkKind: link.kind,
  };

  if (link.kind === "UNSUPPORTED") {
    return {
      ...base,
      outcome: "NEEDS_TEXT",
      draft: null,
      checkFields: [],
      loginWall: false,
    };
  }

  // Try each candidate host in turn. For Facebook that's mbasic, then m, then
  // www — the mobile hosts are likelier to answer a logged-out request.
  let bestText = "";
  let bestEvent: ExtractedEvent | null = null;
  let sawLoginWall = false;

  for (const candidate of link.candidates) {
    const page = await fetchPage(candidate);
    if (!page.ok) continue;

    const extracted = extractMetadata(page.html);

    if (extracted.quality === "COMPLETE") {
      const draft = draftFromMetadata(extracted.event);
      return {
        ...base,
        outcome: "PARSED",
        draft,
        checkFields: checkFieldsFor(draft),
        loginWall: false,
      };
    }

    if (extracted.loginWall) sawLoginWall = true;
    if (extracted.text.length > bestText.length) bestText = extracted.text;
    if (!bestEvent || extracted.quality === "PARTIAL") bestEvent = extracted.event;

    if (extracted.quality === "PARTIAL") break;
  }

  // Nothing readable — or a login wall — so the parent has to paste the text.
  if (!bestText || sawLoginWall) {
    return {
      ...base,
      outcome: "NEEDS_TEXT",
      draft: bestEvent ? draftFromMetadata(bestEvent) : null,
      checkFields: [],
      loginWall: sawLoginWall,
    };
  }

  if (!isParsingAvailable()) {
    return {
      ...base,
      outcome: "PARSING_DISABLED",
      draft: bestEvent ? draftFromMetadata(bestEvent) : null,
      checkFields: [],
      loginWall: false,
    };
  }

  const parsed = await parseEventText(bestText, bestEvent ?? undefined);
  if (!parsed.ok) {
    return {
      ...base,
      outcome: parsed.reason === "no_api_key" ? "PARSING_DISABLED" : "NEEDS_TEXT",
      draft: bestEvent ? draftFromMetadata(bestEvent) : null,
      checkFields: [],
      loginWall: false,
    };
  }

  return {
    ...base,
    outcome: "PARSED",
    draft: parsed.draft,
    checkFields: checkFieldsFor(parsed.draft),
    loginWall: false,
  };
}

/** The paste-the-text path: no fetching, straight to the model. */
export async function ingestText(
  text: string,
  sourceUrl?: string | null,
): Promise<IngestResult> {
  const link = sourceUrl ? classifyLink(sourceUrl) : null;
  const base = {
    sourceType: link?.sourceType ?? ("MANUAL" as SourceType),
    sourceUrl: link?.url ?? null,
    linkKind: link?.kind ?? ("GENERIC" as LinkKind),
    loginWall: false,
  };

  if (!isParsingAvailable()) {
    return { ...base, outcome: "PARSING_DISABLED", draft: null, checkFields: [] };
  }

  const parsed = await parseEventText(text);
  if (!parsed.ok) {
    return { ...base, outcome: "NEEDS_TEXT", draft: null, checkFields: [] };
  }

  return {
    ...base,
    outcome: "PARSED",
    draft: parsed.draft,
    checkFields: checkFieldsFor(parsed.draft),
  };
}

export { classifyLink, extractMetadata, fetchPage, isParsingAvailable };
export type { DraftActivity };
