import * as cheerio from "cheerio";

/**
 * Pull whatever structured data a page is willing to give us, best source first:
 *
 *   1. JSON-LD `@type: Event` — Eventbrite, Meetup and most ticketing platforms
 *      emit this complete, with start, end, venue and price. When it's there the
 *      job is finished: no model call, no cost, no latency.
 *   2. OpenGraph — a title and description, sometimes a date. Enough to hand to
 *      the parser as a head start.
 *   3. The <title> and a meta description, as a last resort.
 *
 * Facebook is the reason step 3 exists and the reason for `NEEDS_TEXT`: a
 * logged-out request usually lands on a login interstitial, and no amount of
 * parsing turns that into an event.
 */

export type SignalQuality = "COMPLETE" | "PARTIAL" | "NEEDS_TEXT";

export interface ExtractedEvent {
  title: string | null;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  venueName: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  priceCents: number | null;
  isFree: boolean | null;
  imageUrl: string | null;
}

export interface ExtractionResult {
  quality: SignalQuality;
  event: ExtractedEvent;
  /** Page text, trimmed, for the model to work on when the metadata is thin. */
  text: string;
  /** True when the page is a login wall rather than content. */
  loginWall: boolean;
}

const EMPTY: ExtractedEvent = {
  title: null,
  description: null,
  startsAt: null,
  endsAt: null,
  venueName: null,
  address: null,
  postalCode: null,
  city: null,
  priceCents: null,
  isFree: null,
  imageUrl: null,
};

/** Phrases that mean "sign in", in the languages Facebook serves this region. */
const LOGIN_WALL_MARKERS = [
  "you must log in to continue",
  "vous devez vous connecter",
  "log into facebook",
  "connectez-vous à facebook",
  "connexion à facebook",
  "sign up for facebook",
  "create new account",
  "log in or sign up to view",
];

function detectLoginWall(html: string, text: string): boolean {
  const haystack = `${text.slice(0, 4000)} ${html.slice(0, 2000)}`.toLowerCase();
  if (LOGIN_WALL_MARKERS.some((marker) => haystack.includes(marker))) return true;
  // A checkpoint/login redirect that still returned 200.
  return /<form[^>]+action="[^"]*\/login/i.test(html);
}

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

type Json = Record<string, unknown>;

const asRecord = (value: unknown): Json | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" ? clean(value) : null;

/** Walk a JSON-LD document, which may be a graph, an array, or a single node. */
function* walkJsonLd(node: unknown): Generator<Json> {
  if (Array.isArray(node)) {
    for (const item of node) yield* walkJsonLd(item);
    return;
  }
  const record = asRecord(node);
  if (!record) return;

  yield record;
  if ("@graph" in record) yield* walkJsonLd(record["@graph"]);
}

function isEventNode(node: Json): boolean {
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some(
    (t) => typeof t === "string" && /event$/i.test(t.replace(/^schema:/, "")),
  );
}

function priceFromOffers(offers: unknown): {
  priceCents: number | null;
  isFree: boolean | null;
} {
  const list = Array.isArray(offers) ? offers : [offers];
  let lowest: number | null = null;

  for (const entry of list) {
    const offer = asRecord(entry);
    if (!offer) continue;
    const raw = offer.price ?? offer.lowPrice;
    const value =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseFloat(raw.replace(",", "."))
          : Number.NaN;
    if (Number.isFinite(value) && (lowest === null || value < lowest)) {
      lowest = value;
    }
  }

  if (lowest === null) return { priceCents: null, isFree: null };
  return { priceCents: Math.round(lowest * 100), isFree: lowest === 0 };
}

function locationFrom(node: Json): Pick<
  ExtractedEvent,
  "venueName" | "address" | "postalCode" | "city"
> {
  const location = asRecord(node.location);
  if (!location) {
    return {
      venueName: asString(node.location),
      address: null,
      postalCode: null,
      city: null,
    };
  }

  const address = asRecord(location.address);
  if (!address) {
    return {
      venueName: asString(location.name),
      address: asString(location.address),
      postalCode: null,
      city: null,
    };
  }

  const street = asString(address.streetAddress);
  return {
    venueName: asString(location.name),
    address: street ?? asString(address.name),
    postalCode: asString(address.postalCode),
    city: asString(address.addressLocality),
  };
}

function fromJsonLd($: cheerio.CheerioAPI): ExtractedEvent | null {
  const blocks = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).contents().text())
    .get();

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue; // A malformed block is not a reason to abandon the page.
    }

    for (const node of walkJsonLd(parsed)) {
      if (!isEventNode(node)) continue;

      const { priceCents, isFree } = priceFromOffers(node.offers);
      const image = Array.isArray(node.image) ? node.image[0] : node.image;

      return {
        title: asString(node.name),
        description: asString(node.description),
        startsAt: toIso(node.startDate),
        endsAt: toIso(node.endDate),
        ...locationFrom(node),
        priceCents,
        isFree: isFree ?? (node.isAccessibleForFree === true ? true : null),
        imageUrl: asString(image),
      };
    }
  }

  return null;
}

function fromOpenGraph($: cheerio.CheerioAPI): ExtractedEvent {
  const meta = (property: string) =>
    clean(
      $(`meta[property="${property}"]`).attr("content") ??
        $(`meta[name="${property}"]`).attr("content"),
    );

  return {
    ...EMPTY,
    title: meta("og:title") ?? clean($("title").first().text()),
    description: meta("og:description") ?? meta("description"),
    // Some sites still emit the old article/event time properties.
    startsAt: toIso(meta("event:start_time") ?? meta("article:published_time")),
    endsAt: toIso(meta("event:end_time")),
    venueName: meta("og:site_name"),
    imageUrl: meta("og:image"),
  };
}

/** Readable page text, with the furniture stripped out. */
function pageText($: cheerio.CheerioAPI): string {
  $("script, style, noscript, svg, iframe, nav, footer, header").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 12_000);
}

function isComplete(event: ExtractedEvent): boolean {
  return Boolean(event.title && event.startsAt && (event.venueName || event.address));
}

function isEmpty(event: ExtractedEvent): boolean {
  return !event.title && !event.description && !event.startsAt;
}

export function extractMetadata(html: string): ExtractionResult {
  const $ = cheerio.load(html);

  // Read the metadata before pageText() strips the document down.
  const jsonLd = fromJsonLd($);
  const openGraph = fromOpenGraph($);
  const text = pageText($);
  const loginWall = detectLoginWall(html, text);

  if (jsonLd && isComplete(jsonLd)) {
    return { quality: "COMPLETE", event: jsonLd, text, loginWall: false };
  }

  // Prefer any JSON-LD field over the OpenGraph equivalent, but take whichever
  // of the two actually has a value.
  const merged: ExtractedEvent = {
    title: jsonLd?.title ?? openGraph.title,
    description: jsonLd?.description ?? openGraph.description,
    startsAt: jsonLd?.startsAt ?? openGraph.startsAt,
    endsAt: jsonLd?.endsAt ?? openGraph.endsAt,
    venueName: jsonLd?.venueName ?? null,
    address: jsonLd?.address ?? null,
    postalCode: jsonLd?.postalCode ?? null,
    city: jsonLd?.city ?? null,
    priceCents: jsonLd?.priceCents ?? null,
    isFree: jsonLd?.isFree ?? null,
    imageUrl: jsonLd?.imageUrl ?? openGraph.imageUrl,
  };

  if (loginWall || isEmpty(merged)) {
    return { quality: "NEEDS_TEXT", event: merged, text, loginWall };
  }

  return { quality: "PARTIAL", event: merged, text, loginWall: false };
}
