import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyLink } from "@/lib/ingest/classify";
import { extractMetadata } from "@/lib/ingest/extract-metadata";
import {
  fetchPage,
  isHostAllowed,
  isPrivateAddress,
} from "@/lib/ingest/fetch-page";

const fixture = (name: string) =>
  readFileSync(
    path.join(import.meta.dirname, "..", "fixtures", name),
    "utf8",
  );

describe("classifyLink", () => {
  it("recognises a Facebook event and pulls out its id", () => {
    const result = classifyLink(
      "https://www.facebook.com/events/1234567890123456/",
    );
    expect(result.kind).toBe("FACEBOOK_EVENT");
    expect(result.sourceType).toBe("FACEBOOK");
    expect(result.eventId).toBe("1234567890123456");
  });

  it("tries the mobile hosts first, since they answer logged-out requests", () => {
    const result = classifyLink("https://www.facebook.com/events/999888777666/");
    expect(result.candidates[0]).toContain("mbasic.facebook.com");
    expect(result.candidates[1]).toContain("m.facebook.com");
    expect(result.candidates).toHaveLength(3);
  });

  it("handles a share link with a trailing segment", () => {
    const result = classifyLink(
      "https://www.facebook.com/events/1234567890123456/1234567890123457/",
    );
    expect(result.eventId).toBe("1234567890123456");
  });

  it("handles the m. and mbasic. hosts as input too", () => {
    expect(classifyLink("https://m.facebook.com/events/555444333222").kind).toBe(
      "FACEBOOK_EVENT",
    );
    expect(
      classifyLink("https://mbasic.facebook.com/events/555444333222").eventId,
    ).toBe("555444333222");
  });

  it("strips tracking parameters that identify the sharer", () => {
    const result = classifyLink(
      "https://example.com/event?utm_source=newsletter&utm_medium=email&fbclid=AbC123&id=42",
    );
    expect(result.url).not.toContain("utm_source");
    expect(result.url).not.toContain("fbclid");
    // The parameter that identifies the *event* has to survive.
    expect(result.url).toContain("id=42");
  });

  it("recognises Eventbrite and Meetup", () => {
    expect(classifyLink("https://www.eventbrite.ch/e/atelier-123").kind).toBe(
      "EVENTBRITE",
    );
    expect(
      classifyLink("https://www.meetup.com/lausanne-families/events/301234567/")
        .kind,
    ).toBe("MEETUP");
  });

  it("treats an unknown site as a generic page worth trying", () => {
    const result = classifyLink("https://www.lausanne.ch/bibliotheques");
    expect(result.kind).toBe("GENERIC");
    expect(result.sourceType).toBe("WEB");
  });

  it("rejects a non-http scheme rather than handing it to the fetcher", () => {
    expect(classifyLink("javascript:alert(1)").kind).toBe("UNSUPPORTED");
    expect(classifyLink("file:///etc/passwd").kind).toBe("UNSUPPORTED");
    expect(classifyLink("not a url at all").kind).toBe("UNSUPPORTED");
  });
});

describe("extractMetadata — JSON-LD", () => {
  const result = extractMetadata(fixture("eventbrite-jsonld.html"));

  it("reports a complete signal, so no model call is needed", () => {
    expect(result.quality).toBe("COMPLETE");
  });

  it("reads the whole event out of the structured data", () => {
    expect(result.event.title).toBe("Atelier éveil musical 0-3 ans");
    expect(result.event.venueName).toBe("Maison de quartier sous-gare");
    expect(result.event.address).toBe("Avenue Edouard-Dapples 50");
    expect(result.event.postalCode).toBe("1006");
    expect(result.event.city).toBe("Lausanne");
  });

  it("normalises the dates to ISO", () => {
    expect(result.event.startsAt).toBe("2026-09-12T08:00:00.000Z");
    expect(result.event.endsAt).toBe("2026-09-12T09:00:00.000Z");
  });

  it("converts the offer price to cents", () => {
    expect(result.event.priceCents).toBe(1200);
    expect(result.event.isFree).toBe(false);
  });
});

describe("extractMetadata — Facebook login wall", () => {
  const result = extractMetadata(fixture("facebook-login-wall.html"));

  it("recognises the wall for what it is", () => {
    expect(result.loginWall).toBe(true);
  });

  it("asks for pasted text rather than pretending it found an event", () => {
    expect(result.quality).toBe("NEEDS_TEXT");
  });

  it("does not mistake the page furniture for a title", () => {
    // "Facebook" is an og:title, but the wall flag is what the caller acts on.
    expect(result.event.startsAt).toBeNull();
    expect(result.event.venueName).toBeNull();
  });
});

describe("extractMetadata — Facebook mbasic page that did answer", () => {
  const result = extractMetadata(fixture("facebook-mbasic-event.html"));

  it("is partial: worth handing to the model, not complete on its own", () => {
    expect(result.quality).toBe("PARTIAL");
    expect(result.loginWall).toBe(false);
  });

  it("picks up the OpenGraph title", () => {
    expect(result.event.title).toBe("Heure du conte à la bibliothèque");
  });

  it("keeps the body text, which is where the date and ages actually are", () => {
    expect(result.text).toContain("Samedi 12 septembre 2026");
    expect(result.text).toContain("2-5 ans");
    expect(result.text).toContain("Place Chauderon 11");
  });
});

describe("extractMetadata — a plain venue page", () => {
  const result = extractMetadata(fixture("venue-page.html"));

  it("is partial, with the opening hours left in the text for the model", () => {
    expect(result.quality).toBe("PARTIAL");
    expect(result.text).toContain("Mardi 15h00 – 18h30");
    expect(result.text).toContain("Rue de Genève 52");
  });

  it("strips the navigation and footer furniture", () => {
    expect(result.text).not.toContain("Accueil · Horaires · Contact");
    expect(result.text).not.toContain("© Ville de Lausanne");
  });

  it("falls back to the document title", () => {
    expect(result.event.title).toContain("Ludothèque de Lausanne");
  });
});

describe("extractMetadata — degenerate input", () => {
  it("asks for text when the page is empty", () => {
    expect(extractMetadata("<html><body></body></html>").quality).toBe(
      "NEEDS_TEXT",
    );
  });

  it("survives malformed JSON-LD instead of throwing", () => {
    const html = `<html><head>
      <script type="application/ld+json">{ this is not json </script>
      <meta property="og:title" content="Un atelier" />
      </head><body><p>Du texte</p></body></html>`;
    const result = extractMetadata(html);
    expect(result.event.title).toBe("Un atelier");
  });

  it("finds an Event nested inside an @graph", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebSite","name":"Some site"},
        {"@type":"Event","name":"Contes au parc","startDate":"2026-09-05T15:00:00+02:00",
         "location":{"@type":"Place","name":"Parc de Milan"}}
      ]}</script></head><body></body></html>`;
    const result = extractMetadata(html);
    expect(result.quality).toBe("COMPLETE");
    expect(result.event.title).toBe("Contes au parc");
    expect(result.event.venueName).toBe("Parc de Milan");
  });
});

/**
 * The fetcher issues requests to URLs supplied by the public, so these are the
 * tests that stop it becoming a proxy into anything the server can reach.
 */
describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata — the classic SSRF target
    "0.0.0.0",
    "100.64.0.1", // CGNAT
    "224.0.0.1", // multicast
  ])("refuses %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "157.240.1.35", "172.32.0.1", "192.169.0.1"])(
    "allows the public address %s",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );

  it("refuses IPv6 loopback, link-local and unique-local", () => {
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("ff02::1")).toBe(true);
  });

  it("sees through an IPv4-mapped IPv6 address", () => {
    // ::ffff:169.254.169.254 reaches metadata just as well as the bare v4 form.
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows a public IPv6 address", () => {
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("refuses anything that isn't an IP at all", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
    expect(isPrivateAddress("")).toBe(true);
  });
});

describe("isHostAllowed", () => {
  it("refuses localhost by name", async () => {
    expect(await isHostAllowed("localhost")).toBe(false);
    expect(await isHostAllowed("foo.localhost")).toBe(false);
  });

  it("refuses internal-only TLDs", async () => {
    expect(await isHostAllowed("db.internal")).toBe(false);
    expect(await isHostAllowed("printer.local")).toBe(false);
  });

  it("refuses a literal private IP without needing DNS", async () => {
    expect(await isHostAllowed("169.254.169.254")).toBe(false);
    expect(await isHostAllowed("127.0.0.1")).toBe(false);
    expect(await isHostAllowed("10.1.2.3")).toBe(false);
  });

  it("allows a literal public IP", async () => {
    expect(await isHostAllowed("1.1.1.1")).toBe(true);
  });

  it("refuses a name that does not resolve", async () => {
    expect(await isHostAllowed("this-host-does-not-exist.invalid")).toBe(false);
  });
});

describe("fetchPage — the guard, not an incidental failure", () => {
  /**
   * These must come back as `blocked_host`, not as a timeout or a network
   * error: the distinction is whether we refused to open the connection or
   * merely failed to complete it. Only the first is a working guard.
   */
  it.each([
    "http://127.0.0.1/",
    "http://localhost:8080/admin",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://[::1]/",
  ])("refuses %s before connecting", async (url) => {
    const result = await fetchPage(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blocked_host");
  });

  it("refuses a non-http scheme", async () => {
    const result = await fetchPage("ftp://example.com/file");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("blocked_host");
  });

  it("rejects a malformed URL", async () => {
    const result = await fetchPage("http://");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_url");
  });
});
