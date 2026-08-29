# Ouistiti

**« Où sortir avec les ouistitis ? »** — a map of drop-in activities for
under-fives in and around Lausanne. No account, no app store, no friction.

A parent opens it one-handed while holding a toddler, sees what's on nearby right
now, and taps once to tell everyone else whether it's still happening.

---

## What it does

- **Map first.** Every activity is a pin, colour-coded by age group and carrying a
  glyph so the coding doesn't depend on telling orange from green. The ring shows
  indoor or outdoor.
- **Three kinds of thing, one map.** A dated event, a weekly ludothèque, and a
  playground that's simply always there all live in the same table and resolve
  through the same code path.
- **1-tap live status.** *Ça a lieu* / *C'est plein* / *Annulé*. A report from
  within 100 m of the venue verifies the listing and earns its reporter standing.
- **Trust from presence, not accounts.** Being there is the credential. Two
  parents on site confirm a listing; two confirm a cancellation.
- **Paste a link to add something.** Eventbrite and Meetup resolve for free from
  their structured data. Facebook usually needs the event text pasted in — see
  below.
- **Bilingual.** French first, English written natively rather than translated.
- **Installable.** A real PWA: home screen, offline shell, cached tiles.

## Running it

```bash
npm install
cp .env.example .env
npm run db:reset      # create the SQLite database and seed ~27 Lausanne activities
npm run dev
```

Then open http://localhost:3000.

`MOCK_EXTERNAL=1` stubs geocoding and weather with deterministic fixtures, which
makes the app fully usable with no outbound network access:

```bash
MOCK_EXTERNAL=1 npm run dev
```

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path. `file:./prisma/dev.db` for local work. |
| `ANTHROPIC_API_KEY` | Enables parsing pasted event text. Without it, the app still runs — link ingestion falls back to the manual form. |
| `MOCK_EXTERNAL` | `1` to stub Nominatim and Open-Meteo. |
| `NEXT_PUBLIC_SITE_URL` | Public base URL, used to build absolute OpenGraph URLs for shared links. |

## Testing

```bash
npm test              # 206 unit tests
npm run test:e2e      # 11 Playwright smoke tests (starts its own server)
npx tsc --noEmit
```

The e2e suite runs against `prisma/e2e.db` with `MOCK_EXTERNAL=1`, so it needs no
network. It asserts on the DOM rather than on rendered map imagery — a test that
depended on third-party tiles would fail for reasons unrelated to the app.

To run against a Chromium the environment already provides instead of
Playwright's own:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

---

## How it's put together

### One table, three kinds

`Activity.kind` is `EVENT` (a dated one-off), `RECURRING` (a weekly pattern) or
`PLACE` (a venue with opening hours, or always open). Time is a property of the
activity rather than a second entity, so `nextOccurrences()` in
[`lib/schedule.ts`](lib/schedule.ts) resolves all three into the same list of
concrete windows. The map, the filters and "what's on today" therefore have
exactly one code path — and a weekly activity doesn't vanish after its first date,
which a pure events model would do.

Everything is resolved through `Europe/Zurich`, on both sides of the DST switch: a
storytime at 14:00 is at 14:00 in March and in November, and it displays as 14:00
whatever timezone the reader's phone is set to.

### Ages in months

Stored as a month range, not a group. The three display groups (0–12m, 1–3y, 3–5y)
are an overlap test in [`lib/age.ts`](lib/age.ts), so an activity for 6–30 month
olds appears under two of them without anyone picking a box, and moving a boundary
needs no data migration.

### Trust, in [`lib/trust.ts`](lib/trust.ts)

Pure functions, no I/O. A report from within `PROXIMITY_RADIUS_M` (100 m) is
*proximity-verified*: it earns its reporter trust and counts towards the badge. A
report from elsewhere is still recorded — it's useful to other parents — but proves
nothing.

Verification and cancellation are deliberately asymmetric. One report from an
established reporter can verify a listing; **cancelling always needs two people who
were there**, because wrongly hiding something a family is already travelling
towards is the worse failure. `OFFICIAL` is a statement about provenance and is
never overwritten by community reports, and verification only ever moves up.

### Ingestion, in [`lib/ingest/`](lib/ingest/)

The chain runs cheapest-first:

```
classify → fetch → JSON-LD → OpenGraph + Claude → paste text → manual form
```

JSON-LD is the happy path and costs nothing: Eventbrite and Meetup emit a complete
schema.org `Event`, so those links resolve with **no model call at all**. Claude
(`claude-opus-5`, structured outputs) is the fallback for pages that only offer
prose.

**On Facebook.** Facebook serves a login wall to any request without a session, so
scraping an event link is not reliable and no amount of engineering makes it so.
The chain recognises the link and tries `mbasic.` and `m.` first, which are
likelier to answer a logged-out client. When they don't, it asks for the event
text instead — and that path works well, because the Facebook event text format is
regular and parses accurately. Expect real Facebook links to land there more often
than not. Every outcome ends somewhere useful; the manual form is always one tap
away.

Pasted text is untrusted input — it reaches the model from a stranger by way of a
parent's clipboard. The system prompt says so, and the structured output schema is
what actually constrains the result. Anything submitted saves as `UNVERIFIED`; a
submission cannot declare itself official.

**The fetcher is SSRF-guarded.** It issues requests to URLs supplied by the public,
so every host is resolved and checked against private address space before a
connection opens — on the original URL and on every redirect hop, with redirects
followed by hand because `fetch`'s own following would skip the check.

### Portability

SQLite for now, but nothing SQLite-specific leaks into the model: no Prisma `enum`s
(SQLite lacks them — the zod enums in [`lib/enums.ts`](lib/enums.ts) are the source
of truth) and no SQLite-only column types. Moving to Postgres means swapping the
driver adapter in [`lib/db.ts`](lib/db.ts) and the provider in
`prisma/schema.prisma`.

Age, bbox and schedule filtering run in application code against `lib/age` and
`lib/schedule` rather than as SQL predicates, so those rules have one tested
definition instead of two that can drift. At this data size that costs nothing; the
bbox is the first thing to push into the query if it ever outgrows one city.

---

## Known limits

- **Seed coordinates are hand-entered** to roughly building level and have not been
  through a geocoder. Verify them before treating any of it as real data.
- **Facebook link ingestion** is best-effort by design; see above.
- **No moderation tooling.** Anyone can submit, and `HIDDEN` exists in the schema
  but nothing sets it yet.
- **No image ingestion.** Flyer-photo parsing was scoped out.
- **`datetime-local` inputs** render in the browser's UI locale, not the page's.
  That's browser behaviour and not controllable from the page.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Prisma 7 + SQLite ·
Leaflet + OpenStreetMap · Open-Meteo · Nominatim · Anthropic SDK · Vitest ·
Playwright
