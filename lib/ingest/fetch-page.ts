import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetches a page on behalf of whoever pasted the link.
 *
 * That sentence is the whole security problem: an attacker can make our server
 * issue requests to addresses they choose. Left unguarded this is a hole into
 * anything the server can reach that the internet can't — a cloud metadata
 * endpoint, an internal admin panel, a database's HTTP interface. So every host,
 * on the original URL *and* on every redirect hop, is resolved and checked
 * against private address space before a connection is opened.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

// A plain browser UA. Some venue sites serve a stub to anything that looks
// automated; this is about getting the same page a person would see.
const USER_AGENT =
  "Mozilla/5.0 (compatible; OuistitiBot/0.1; +https://github.com/robertoapassini-del/app_childrenevents)";

export type FetchFailure =
  | "invalid_url"
  | "blocked_host"
  | "too_many_redirects"
  | "timeout"
  | "http_error"
  | "too_large"
  | "not_html"
  | "network_error";

export interface FetchedPage {
  ok: true;
  url: string;
  status: number;
  html: string;
}

export interface FetchRejected {
  ok: false;
  reason: FetchFailure;
  status?: number;
}

export type FetchResult = FetchedPage | FetchRejected;

/** Is this IP somewhere the public internet can't reach? */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets as [number, number, number, number];
    if (a === 0) return true; // "this network"
    if (a === 10) return true; // RFC1918
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 192 && b === 0) return true; // IETF protocol assignments
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("ff")) return true; // multicast
    // IPv4-mapped (::ffff:169.254.169.254) would otherwise slip straight past.
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return false;
  }

  return true; // Not an IP at all — refuse rather than guess.
}

/** Resolve a hostname and refuse it if any address it maps to is private. */
export async function isHostAllowed(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase();

  // A bare IP in the URL never needs resolving, and localhost is never valid.
  if (isIP(host)) return !isPrivateAddress(host);
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".internal") || host.endsWith(".local")) return false;

  try {
    const results = await lookup(host, { all: true });
    if (results.length === 0) return false;
    // One private address is enough to refuse: a name resolving to both is a
    // rebinding attempt, not a site we want to read.
    return results.every((entry) => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}

function isHtml(contentType: string | null): boolean {
  if (!contentType) return true; // Unlabelled: let the parser decide.
  return /text\/html|application\/xhtml|text\/plain/i.test(contentType);
}

/** Read a response body, stopping hard at MAX_BYTES. */
async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return null;

  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

/**
 * Fetch one URL, following redirects by hand so each hop can be re-checked.
 * `fetch`'s own redirect following would happily land on 169.254.169.254.
 */
export async function fetchPage(rawUrl: string): Promise<FetchResult> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      return { ok: false, reason: "blocked_host" };
    }
    if (!(await isHostAllowed(current.hostname))) {
      return { ok: false, reason: "blocked_host" };
    }

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "Accept-Language": "fr-CH,fr;q=0.9,en;q=0.8",
        },
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      return { ok: false, reason: timedOut ? "timeout" : "network_error" };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, reason: "http_error", status: response.status };
      try {
        current = new URL(location, current);
      } catch {
        return { ok: false, reason: "invalid_url" };
      }
      continue;
    }

    if (!response.ok) {
      return { ok: false, reason: "http_error", status: response.status };
    }
    if (!isHtml(response.headers.get("content-type"))) {
      return { ok: false, reason: "not_html" };
    }

    const html = await readCapped(response);
    if (html === null) return { ok: false, reason: "too_large" };

    return { ok: true, url: current.toString(), status: response.status, html };
  }

  return { ok: false, reason: "too_many_redirects" };
}
