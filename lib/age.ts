import type { AgeGroupId } from "./enums";

/**
 * Ages are stored on the activity as a month range, not as a group. The three
 * groups below are a *display* concern, so an activity for 6–30 month olds shows
 * up under both "bébés" and "petits" without anyone having to pick a box — and
 * changing where the group boundaries sit never needs a data migration.
 */
export interface AgeGroup {
  id: AgeGroupId;
  minMonths: number;
  /** Exclusive upper bound. */
  maxMonths: number;
  /**
   * Shape drawn alongside the colour, so the coding survives colourblindness.
   * The three are a ring, a triangle and a diamond — no shared silhouette, and
   * each stays distinct at 12px. Rendered from AGE_ICON_PATHS in
   * components/icons.tsx; this is the key, not a character, because a font is
   * not something to bet an accessibility affordance on.
   */
  icon: AgeGroupId;
  colorVar: string;
  /** Hex twin of colorVar, for canvases and any context without CSS variables. */
  colorHex: string;
}

export const AGE_GROUPS: readonly AgeGroup[] = [
  {
    id: "infant",
    minMonths: 0,
    maxMonths: 12,
    icon: "infant",
    colorVar: "var(--color-sky-ish-500)",
    colorHex: "#2e86c1",
  },
  {
    id: "toddler",
    minMonths: 12,
    maxMonths: 36,
    icon: "toddler",
    colorVar: "var(--color-ouistiti-500)",
    colorHex: "#f2820d",
  },
  {
    id: "preschool",
    minMonths: 36,
    maxMonths: 60,
    icon: "preschool",
    colorVar: "var(--color-fern-500)",
    colorHex: "#2fa36b",
  },
] as const;

export function getAgeGroup(id: AgeGroupId): AgeGroup {
  const group = AGE_GROUPS.find((g) => g.id === id);
  // AgeGroupId is a closed union, so this is unreachable outside a bad cast.
  if (!group) throw new Error(`unknown age group: ${id}`);
  return group;
}

/**
 * Does an activity's month range overlap a group's? Half-open on the upper bound
 * so a 0–12m activity is an infant one and does not bleed into toddlers.
 */
export function overlapsAgeGroup(
  activity: { ageMinMonths: number; ageMaxMonths: number },
  group: AgeGroup,
): boolean {
  return (
    activity.ageMinMonths < group.maxMonths &&
    activity.ageMaxMonths > group.minMonths
  );
}

/** Every group an activity belongs to, in age order. */
export function ageGroupsFor(activity: {
  ageMinMonths: number;
  ageMaxMonths: number;
}): AgeGroup[] {
  return AGE_GROUPS.filter((g) => overlapsAgeGroup(activity, g));
}

/** Matches if the activity overlaps *any* of the selected groups. Empty = no filter. */
export function matchesAgeFilter(
  activity: { ageMinMonths: number; ageMaxMonths: number },
  selected: readonly AgeGroupId[],
): boolean {
  if (selected.length === 0) return true;
  return selected.some((id) => overlapsAgeGroup(activity, getAgeGroup(id)));
}

/** "0–18 mois" / "2–5 ans" — the compact form used on cards. */
export function formatAgeRange(
  activity: { ageMinMonths: number; ageMaxMonths: number },
  locale: "fr" | "en",
): string {
  const { ageMinMonths: min, ageMaxMonths: max } = activity;
  const monthUnit = locale === "fr" ? "mois" : "months";
  const yearUnit = locale === "fr" ? "ans" : "yrs";

  // Under two years, months are what parents actually think in.
  if (max <= 24) return `${min}–${max} ${monthUnit}`;

  const minYears = min / 12;
  const maxYears = max / 12;
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
  return `${fmt(minYears)}–${fmt(maxYears)} ${yearUnit}`;
}
