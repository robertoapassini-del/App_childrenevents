import type { SourceType } from "../enums";

/**
 * What kind of link is this, and can we do anything clever with it?
 *
 * Facebook is the case that matters most — it's where the events actually are —
 * and also the hardest, because Facebook serves a login wall to anyone not
 * signed in. Recognising the link is still worth doing: it lets us try the
 * mobile hosts that sometimes leak OpenGraph tags, and it lets the UI ask for
 * the right thing when they don't.
 */

export type LinkKind =
  | "FACEBOOK_EVENT"
  | "EVENTBRITE"
  | "MEETUP"
  | "GENERIC"
  | "UNSUPPORTED";

export interface ClassifiedLink {
  kind: LinkKind;
  sourceType: SourceType;
  /** Normalised, tracking-free URL to fetch. */
  url: string;
  /** Facebook's numeric event id, when we could find one. */
  eventId: string | null;
  /**
   * Hosts to try in order. Facebook gets its mobile variants, which have
   * historically been more willing to talk to a logged-out client.
   */
  candidates: string[];
}

/** Query params that identify a referrer rather than the content. */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_[ce]id$/i,
  /^ref$/i,
  /^_ga$/i,
  /^igshid$/i,
  /^si$/i,
];

function stripTracking(url: URL): URL {
  const cleaned = new URL(url.toString());
  for (const key of [...cleaned.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) {
      cleaned.searchParams.delete(key);
    }
  }
  return cleaned;
}

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "mbasic.facebook.com",
  "web.facebook.com",
  "fb.me",
  "fb.com",
  "www.fb.com",
]);

/** `/events/123456789/`, or a share link like `/events/123/456/`. */
function facebookEventId(pathname: string): string | null {
  const match = pathname.match(/\/events\/(\d{6,})/);
  return match?.[1] ?? null;
}

export function classifyLink(rawUrl: string): ClassifiedLink {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      kind: "UNSUPPORTED",
      sourceType: "MANUAL",
      url: rawUrl,
      eventId: null,
      candidates: [],
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      kind: "UNSUPPORTED",
      sourceType: "MANUAL",
      url: rawUrl,
      eventId: null,
      candidates: [],
    };
  }

  const clean = stripTracking(parsed);
  const host = clean.hostname.toLowerCase();
  const url = clean.toString();

  if (FACEBOOK_HOSTS.has(host)) {
    const eventId = facebookEventId(clean.pathname);
    // mbasic is the stripped-down host Facebook still serves to old browsers,
    // and it is the likeliest of the three to answer without a session.
    const candidates = eventId
      ? [
          `https://mbasic.facebook.com/events/${eventId}`,
          `https://m.facebook.com/events/${eventId}`,
          `https://www.facebook.com/events/${eventId}`,
        ]
      : [url];

    return {
      kind: "FACEBOOK_EVENT",
      sourceType: "FACEBOOK",
      url,
      eventId,
      candidates,
    };
  }

  if (host.endsWith("eventbrite.com") || host.endsWith("eventbrite.ch")) {
    return {
      kind: "EVENTBRITE",
      sourceType: "EVENTBRITE",
      url,
      eventId: null,
      candidates: [url],
    };
  }

  if (host.endsWith("meetup.com")) {
    return {
      kind: "MEETUP",
      sourceType: "MEETUP",
      url,
      eventId: null,
      candidates: [url],
    };
  }

  return {
    kind: "GENERIC",
    sourceType: "WEB",
    url,
    eventId: null,
    candidates: [url],
  };
}
