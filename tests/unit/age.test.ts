import { describe, expect, it } from "vitest";
import {
  AGE_GROUPS,
  ageGroupsFor,
  formatAgeRange,
  getAgeGroup,
  matchesAgeFilter,
  overlapsAgeGroup,
} from "@/lib/age";
import { AGE_ICON_PATHS } from "@/components/icons";

const range = (ageMinMonths: number, ageMaxMonths: number) => ({
  ageMinMonths,
  ageMaxMonths,
});

describe("overlapsAgeGroup", () => {
  it("matches an activity sitting squarely inside a group", () => {
    expect(overlapsAgeGroup(range(18, 30), getAgeGroup("toddler"))).toBe(true);
  });

  it("treats the upper bound as exclusive so groups don't bleed", () => {
    // A 0–12 month activity is for infants, and is *not* a toddler activity.
    expect(overlapsAgeGroup(range(0, 12), getAgeGroup("infant"))).toBe(true);
    expect(overlapsAgeGroup(range(0, 12), getAgeGroup("toddler"))).toBe(false);
  });

  it("matches an activity that merely straddles a group boundary", () => {
    const straddling = range(10, 14);
    expect(overlapsAgeGroup(straddling, getAgeGroup("infant"))).toBe(true);
    expect(overlapsAgeGroup(straddling, getAgeGroup("toddler"))).toBe(true);
  });

  it("excludes an activity entirely above the group", () => {
    expect(overlapsAgeGroup(range(48, 60), getAgeGroup("infant"))).toBe(false);
  });
});

describe("ageGroupsFor", () => {
  it("returns every overlapping group in age order", () => {
    expect(ageGroupsFor(range(0, 60)).map((g) => g.id)).toEqual([
      "infant",
      "toddler",
      "preschool",
    ]);
  });

  it("returns a single group for a narrow range", () => {
    expect(ageGroupsFor(range(40, 55)).map((g) => g.id)).toEqual(["preschool"]);
  });
});

describe("matchesAgeFilter", () => {
  it("treats an empty selection as no filter at all", () => {
    expect(matchesAgeFilter(range(48, 60), [])).toBe(true);
  });

  it("matches if any selected group overlaps", () => {
    expect(matchesAgeFilter(range(30, 40), ["infant", "preschool"])).toBe(true);
  });

  it("rejects when no selected group overlaps", () => {
    expect(matchesAgeFilter(range(36, 60), ["infant"])).toBe(false);
  });
});

describe("age group definitions", () => {
  it("gives every group a distinct shape, so colour is never the only cue", () => {
    const icons = AGE_GROUPS.map((g) => g.icon);
    expect(new Set(icons).size).toBe(AGE_GROUPS.length);
  });

  it("has a drawable path for every group's shape", () => {
    // The shapes used to be text characters, which render as emoji or tofu
    // depending on the font. If a group ever loses its path, the colourblind
    // fallback silently disappears — so assert the paths exist.
    for (const group of AGE_GROUPS) {
      expect(AGE_ICON_PATHS[group.icon]?.length).toBeGreaterThan(0);
    }
  });

  it("gives every group a hex colour matching its CSS variable name", () => {
    for (const group of AGE_GROUPS) {
      expect(group.colorHex).toMatch(/^#[0-9a-f]{6}$/);
      expect(group.colorVar).toMatch(/^var\(--color-/);
    }
  });

  it("covers 0–60 months with no gaps between groups", () => {
    const sorted = [...AGE_GROUPS].sort((a, b) => a.minMonths - b.minMonths);
    expect(sorted[0].minMonths).toBe(0);
    expect(sorted.at(-1)!.maxMonths).toBe(60);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].minMonths).toBe(sorted[i - 1].maxMonths);
    }
  });
});

describe("formatAgeRange", () => {
  it("uses months for the under-twos", () => {
    expect(formatAgeRange(range(0, 12), "fr")).toBe("0–12 mois");
    expect(formatAgeRange(range(6, 24), "en")).toBe("6–24 months");
  });

  it("switches to years once the range goes past two", () => {
    expect(formatAgeRange(range(36, 60), "fr")).toBe("3–5 ans");
    expect(formatAgeRange(range(36, 60), "en")).toBe("3–5 yrs");
  });

  it("keeps a half year readable rather than rounding it away", () => {
    expect(formatAgeRange(range(18, 60), "fr")).toBe("1.5–5 ans");
  });
});
