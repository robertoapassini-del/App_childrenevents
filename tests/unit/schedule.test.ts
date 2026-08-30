import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_DURATION_MS,
  endOfZonedDay,
  isOpenNow,
  nextOccurrenceFrom,
  nextOccurrences,
  occursWithin,
  startOfZonedDay,
  weekendWindow,
  zonedDayKey,
  zonedParts,
  zonedTimeToUtc,
  type SchedulableActivity,
} from "@/lib/schedule";

const base: SchedulableActivity = {
  kind: "PLACE",
  startsAt: null,
  endsAt: null,
  weeklyHours: null,
  alwaysOpen: false,
};

const weekly = (hours: Record<string, { start: string; end: string }[]>) =>
  JSON.stringify(hours);

/** Read back the local wall-clock time of an instant, as "HH:MM". */
const localTime = (d: Date) => {
  const p = zonedParts(d);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

describe("zonedTimeToUtc", () => {
  it("resolves a winter time at UTC+1", () => {
    // 2026-01-14 14:00 in Lausanne is 13:00 UTC (CET).
    expect(zonedTimeToUtc(2026, 1, 14, 14, 0).toISOString()).toBe(
      "2026-01-14T13:00:00.000Z",
    );
  });

  it("resolves a summer time at UTC+2", () => {
    // 2026-07-15 14:00 in Lausanne is 12:00 UTC (CEST).
    expect(zonedTimeToUtc(2026, 7, 15, 14, 0).toISOString()).toBe(
      "2026-07-15T12:00:00.000Z",
    );
  });

  it("handles the day the clocks go forward", () => {
    // 29 March 2026: 02:00 → 03:00. 14:00 that afternoon is already CEST.
    expect(zonedTimeToUtc(2026, 3, 29, 14, 0).toISOString()).toBe(
      "2026-03-29T12:00:00.000Z",
    );
  });

  it("handles the day the clocks go back", () => {
    // 25 October 2026: 03:00 → 02:00. 14:00 that afternoon is CET again.
    expect(zonedTimeToUtc(2026, 10, 25, 14, 0).toISOString()).toBe(
      "2026-10-25T13:00:00.000Z",
    );
  });
});

describe("startOfZonedDay / endOfZonedDay", () => {
  it("snaps to local midnight, not UTC midnight", () => {
    const midMorning = new Date("2026-07-15T08:30:00.000Z");
    expect(startOfZonedDay(midMorning).toISOString()).toBe(
      "2026-07-14T22:00:00.000Z",
    );
  });

  it("puts the end of the day exactly 24 hours after its start", () => {
    const d = new Date("2026-07-15T08:30:00.000Z");
    expect(endOfZonedDay(d).getTime() - startOfZonedDay(d).getTime()).toBe(
      86_400_000,
    );
  });

  it("treats a late-evening local time as the same local day", () => {
    // 23:30 local on 15 July is 21:30 UTC — the UTC date has not yet rolled over.
    const lateEvening = new Date("2026-07-15T21:30:00.000Z");
    expect(zonedParts(startOfZonedDay(lateEvening)).day).toBe(15);
  });
});

describe("zonedDayKey", () => {
  it("groups an instant onto its Lausanne day", () => {
    expect(zonedDayKey(new Date("2026-07-15T08:00:00.000Z"))).toBe("2026-07-15");
  });

  it("puts a late-evening local time on the local day, not the UTC one", () => {
    // 00:30 on the 16th in Lausanne is still the 15th in UTC.
    expect(zonedDayKey(new Date("2026-07-15T22:30:00.000Z"))).toBe("2026-07-16");
  });

  it("puts an early-hours UTC time on the right local day", () => {
    // 01:00 UTC on the 16th is 03:00 local on the 16th.
    expect(zonedDayKey(new Date("2026-07-16T01:00:00.000Z"))).toBe("2026-07-16");
  });

  it("zero-pads so keys sort and compare as strings", () => {
    expect(zonedDayKey(new Date("2026-01-05T12:00:00.000Z"))).toBe("2026-01-05");
  });
});

describe("nextOccurrences — EVENT", () => {
  const event: SchedulableActivity = {
    ...base,
    kind: "EVENT",
    startsAt: new Date("2026-07-15T08:00:00.000Z"),
    endsAt: new Date("2026-07-15T10:00:00.000Z"),
  };

  it("returns the single window when it falls inside the range", () => {
    const out = nextOccurrences(
      event,
      new Date("2026-07-15T00:00:00.000Z"),
      new Date("2026-07-16T00:00:00.000Z"),
    );
    expect(out).toHaveLength(1);
    expect(out[0].start.toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("includes an event already underway, which is exactly what's being looked for", () => {
    const out = nextOccurrences(
      event,
      new Date("2026-07-15T09:00:00.000Z"),
      new Date("2026-07-15T23:00:00.000Z"),
    );
    expect(out).toHaveLength(1);
  });

  it("excludes an event that finished before the window", () => {
    const out = nextOccurrences(
      event,
      new Date("2026-07-15T10:00:00.000Z"),
      new Date("2026-07-16T00:00:00.000Z"),
    );
    expect(out).toHaveLength(0);
  });

  it("assumes a default duration when no end time was given", () => {
    const open = { ...event, endsAt: null };
    const [occurrence] = nextOccurrences(
      open,
      new Date("2026-07-15T00:00:00.000Z"),
      new Date("2026-07-16T00:00:00.000Z"),
    );
    expect(occurrence.end.getTime() - occurrence.start.getTime()).toBe(
      DEFAULT_EVENT_DURATION_MS,
    );
  });

  it("returns nothing for an event with no date at all", () => {
    const out = nextOccurrences(
      { ...event, startsAt: null },
      new Date("2026-07-15T00:00:00.000Z"),
      new Date("2026-07-16T00:00:00.000Z"),
    );
    expect(out).toHaveLength(0);
  });
});

describe("nextOccurrences — RECURRING", () => {
  const ludo: SchedulableActivity = {
    ...base,
    kind: "RECURRING",
    weeklyHours: weekly({
      wed: [{ start: "14:00", end: "17:00" }],
      sat: [{ start: "09:30", end: "12:00" }],
    }),
  };

  it("finds each matching weekday in the window", () => {
    // 13–20 July 2026: one Wednesday (15th) and one Saturday (18th).
    const out = nextOccurrences(
      ludo,
      new Date("2026-07-13T00:00:00.000Z"),
      new Date("2026-07-20T00:00:00.000Z"),
    );
    expect(out).toHaveLength(2);
    expect(localTime(out[0].start)).toBe("14:00");
    expect(localTime(out[1].start)).toBe("09:30");
  });

  it("returns occurrences in chronological order", () => {
    const out = nextOccurrences(
      ludo,
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-08-01T00:00:00.000Z"),
    );
    const times = out.map((o) => o.start.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("spans a month boundary without dropping a week", () => {
    // July 2026 has 5 Wednesdays; the window to 5 August adds one more.
    const out = nextOccurrences(
      ludo,
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-08-06T00:00:00.000Z"),
    );
    const wednesdays = out.filter((o) => localTime(o.start) === "14:00");
    expect(wednesdays).toHaveLength(6);
  });

  it("keeps the local wall-clock time across the DST switch", () => {
    // Straddles 25 October 2026, when the clocks go back.
    const out = nextOccurrences(
      ludo,
      new Date("2026-10-19T00:00:00.000Z"),
      new Date("2026-11-02T00:00:00.000Z"),
    );
    const wednesdays = out.filter((o) => localTime(o.start) === "14:00");
    expect(wednesdays).toHaveLength(2);
    // Same local time, one hour apart in UTC — the whole point of the exercise.
    expect(wednesdays[0].start.toISOString()).toBe("2026-10-21T12:00:00.000Z");
    expect(wednesdays[1].start.toISOString()).toBe("2026-10-28T13:00:00.000Z");
  });

  it("includes a session already underway", () => {
    const out = nextOccurrences(
      ludo,
      new Date("2026-07-15T13:00:00.000Z"), // 15:00 local, mid-session
      new Date("2026-07-15T20:00:00.000Z"),
    );
    expect(out).toHaveLength(1);
  });

  it("returns nothing when the weekly hours are unparseable", () => {
    const broken = { ...ludo, weeklyHours: "{not json" };
    expect(
      nextOccurrences(
        broken,
        new Date("2026-07-13T00:00:00.000Z"),
        new Date("2026-07-20T00:00:00.000Z"),
      ),
    ).toHaveLength(0);
  });

  it("returns nothing for an inverted window", () => {
    expect(
      nextOccurrences(
        ludo,
        new Date("2026-07-20T00:00:00.000Z"),
        new Date("2026-07-13T00:00:00.000Z"),
      ),
    ).toHaveLength(0);
  });
});

describe("nextOccurrences — PLACE", () => {
  it("fills the whole window when the place is always open", () => {
    const park: SchedulableActivity = { ...base, alwaysOpen: true };
    const from = new Date("2026-07-15T00:00:00.000Z");
    const to = new Date("2026-07-16T00:00:00.000Z");
    expect(nextOccurrences(park, from, to)).toEqual([{ start: from, end: to }]);
  });

  it("uses opening hours when the place has them", () => {
    const pool: SchedulableActivity = {
      ...base,
      weeklyHours: weekly({ wed: [{ start: "07:00", end: "20:00" }] }),
    };
    const out = nextOccurrences(
      pool,
      new Date("2026-07-15T00:00:00.000Z"),
      new Date("2026-07-16T00:00:00.000Z"),
    );
    expect(out).toHaveLength(1);
    expect(localTime(out[0].start)).toBe("07:00");
    expect(localTime(out[0].end)).toBe("20:00");
  });

  it("handles two separate windows on one day", () => {
    const split: SchedulableActivity = {
      ...base,
      weeklyHours: weekly({
        wed: [
          { start: "09:00", end: "12:00" },
          { start: "14:00", end: "18:00" },
        ],
      }),
    };
    const out = nextOccurrences(
      split,
      new Date("2026-07-15T00:00:00.000Z"),
      new Date("2026-07-16T00:00:00.000Z"),
    );
    expect(out.map((o) => localTime(o.start))).toEqual(["09:00", "14:00"]);
  });
});

describe("isOpenNow", () => {
  const pool: SchedulableActivity = {
    ...base,
    weeklyHours: weekly({ wed: [{ start: "07:00", end: "20:00" }] }),
  };

  it("is true inside the opening window", () => {
    // 12:00 local on Wednesday 15 July 2026.
    expect(isOpenNow(pool, new Date("2026-07-15T10:00:00.000Z"))).toBe(true);
  });

  it("is false before opening", () => {
    // 06:00 local.
    expect(isOpenNow(pool, new Date("2026-07-15T04:00:00.000Z"))).toBe(false);
  });

  it("is false at the exact closing instant", () => {
    // 20:00 local — the window's end is exclusive.
    expect(isOpenNow(pool, new Date("2026-07-15T18:00:00.000Z"))).toBe(false);
  });

  it("is true at the exact opening instant", () => {
    expect(isOpenNow(pool, new Date("2026-07-15T05:00:00.000Z"))).toBe(true);
  });

  it("is false on a day with no hours", () => {
    // Thursday.
    expect(isOpenNow(pool, new Date("2026-07-16T10:00:00.000Z"))).toBe(false);
  });

  it("is always true for an always-open place", () => {
    expect(
      isOpenNow({ ...base, alwaysOpen: true }, new Date("2026-01-01T03:00:00.000Z")),
    ).toBe(true);
  });
});

describe("weekendWindow", () => {
  it("looks forward to Saturday from midweek", () => {
    // Wednesday 15 July 2026.
    const w = weekendWindow(new Date("2026-07-15T10:00:00.000Z"));
    expect(zonedParts(w.start).day).toBe(18); // Saturday
    expect(w.end.getTime() - w.start.getTime()).toBe(2 * 86_400_000);
  });

  it("treats a Saturday as the weekend already underway", () => {
    const w = weekendWindow(new Date("2026-07-18T10:00:00.000Z"));
    expect(zonedParts(w.start).day).toBe(18);
  });

  it("still covers Sunday when asked on Sunday", () => {
    const w = weekendWindow(new Date("2026-07-19T10:00:00.000Z"));
    expect(zonedParts(w.start).day).toBe(18);
    expect(w.end.getTime()).toBeGreaterThan(
      new Date("2026-07-19T10:00:00.000Z").getTime(),
    );
  });
});

describe("nextOccurrenceFrom / occursWithin", () => {
  const storytime: SchedulableActivity = {
    ...base,
    kind: "RECURRING",
    weeklyHours: weekly({ wed: [{ start: "10:00", end: "10:30" }] }),
  };

  it("finds the next session from an arbitrary moment", () => {
    // Monday 13 July → next is Wednesday 15 July.
    const next = nextOccurrenceFrom(storytime, new Date("2026-07-13T09:00:00.000Z"));
    expect(next).not.toBeNull();
    expect(zonedParts(next!.start).day).toBe(15);
  });

  it("returns null when nothing falls inside the horizon", () => {
    const noHours = { ...storytime, weeklyHours: weekly({}) };
    expect(nextOccurrenceFrom(noHours, new Date("2026-07-13T09:00:00.000Z"))).toBeNull();
  });

  it("answers whether anything happens in a given window", () => {
    const wednesday = {
      start: new Date("2026-07-15T00:00:00.000Z"),
      end: new Date("2026-07-16T00:00:00.000Z"),
    };
    const thursday = {
      start: new Date("2026-07-16T00:00:00.000Z"),
      end: new Date("2026-07-17T00:00:00.000Z"),
    };
    expect(occursWithin(storytime, wednesday)).toBe(true);
    expect(occursWithin(storytime, thursday)).toBe(false);
  });
});
