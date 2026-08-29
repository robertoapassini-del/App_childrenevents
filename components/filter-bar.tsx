"use client";

import { AGE_GROUPS } from "@/lib/age";
import { useI18n } from "@/lib/i18n/context";
import type { useFilters } from "@/lib/use-filters";

type FilterControls = ReturnType<typeof useFilters>;

function Pill({
  active,
  onClick,
  children,
  glyph,
  glyphColor,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  glyph?: string;
  glyphColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pill ${active ? "pill-on" : "pill-off"}`}
    >
      {glyph ? (
        <span
          aria-hidden="true"
          className="text-[11px]"
          style={active ? undefined : { color: glyphColor }}
        >
          {glyph}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export function FilterBar({ controls }: { controls: FilterControls }) {
  const { t } = useI18n();
  const { filters, isFiltered, toggleAge, toggleSetting, setWhen, reset } =
    controls;

  return (
    <div
      role="group"
      aria-label={t.a11y.filterGroup}
      className="flex gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {AGE_GROUPS.map((group) => (
        <Pill
          key={group.id}
          active={filters.age.includes(group.id)}
          onClick={() => toggleAge(group.id)}
          glyph={group.glyph}
          glyphColor={group.colorVar}
        >
          {t.filters[group.id]}
        </Pill>
      ))}

      <span className="my-1 w-px shrink-0 bg-ouistiti-200" aria-hidden="true" />

      <Pill
        active={filters.setting.includes("INDOOR")}
        onClick={() => toggleSetting("INDOOR")}
        glyph="⌂"
      >
        {t.filters.indoor}
      </Pill>
      <Pill
        active={filters.setting.includes("OUTDOOR")}
        onClick={() => toggleSetting("OUTDOOR")}
        glyph="❋"
      >
        {t.filters.outdoor}
      </Pill>

      <span className="my-1 w-px shrink-0 bg-ouistiti-200" aria-hidden="true" />

      <Pill active={filters.when === "today"} onClick={() => setWhen("today")}>
        {t.filters.today}
      </Pill>
      <Pill active={filters.when === "weekend"} onClick={() => setWhen("weekend")}>
        {t.filters.weekend}
      </Pill>
      <Pill active={filters.when === "opennow"} onClick={() => setWhen("opennow")}>
        {t.filters.openNow}
      </Pill>

      {isFiltered ? (
        <button
          type="button"
          onClick={reset}
          className="tap shrink-0 px-2 text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-ouistiti-700"
        >
          {t.filters.reset}
        </button>
      ) : null}
    </div>
  );
}
