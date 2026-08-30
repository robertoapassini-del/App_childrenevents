"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AgeGroupId, Setting, WhenFilter } from "@/lib/enums";

/**
 * Filters live in the URL, not in component state. A filtered view is then a
 * link a parent can send to another parent — which, for an app whose main
 * distribution channel is a WhatsApp group, is the point.
 */

export interface Filters {
  age: AgeGroupId[];
  setting: Setting[];
  when: WhenFilter;
  activityId: string | null;
}

function parseList<T extends string>(
  raw: string | null,
  guard: (value: string) => value is T,
): T[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(guard);
}

const isAgeGroup = (v: string): v is AgeGroupId =>
  AgeGroupId.safeParse(v).success;
const isSetting = (v: string): v is Setting => Setting.safeParse(v).success;

export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters = useMemo<Filters>(() => {
    const when = WhenFilter.safeParse(params.get("when"));
    return {
      age: parseList(params.get("age"), isAgeGroup),
      setting: parseList(params.get("setting"), isSetting),
      when: when.success ? when.data : "all",
      activityId: params.get("a"),
    };
  }, [params]);

  const write = useCallback(
    (next: Partial<Filters>) => {
      const merged = { ...filters, ...next };
      const query = new URLSearchParams(params.toString());

      const set = (key: string, value: string | null) => {
        if (value) query.set(key, value);
        else query.delete(key);
      };

      set("age", merged.age.join(","));
      set("setting", merged.setting.join(","));
      set("when", merged.when === "all" ? null : merged.when);
      set("a", merged.activityId);

      const search = query.toString();
      // Replace rather than push: a filter tap is a refinement, not a step the
      // back button should have to walk through one pill at a time.
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [filters, params, pathname, router],
  );

  const toggleAge = useCallback(
    (id: AgeGroupId) =>
      write({
        age: filters.age.includes(id)
          ? filters.age.filter((a) => a !== id)
          : [...filters.age, id],
      }),
    [filters.age, write],
  );

  const toggleSetting = useCallback(
    (value: Setting) =>
      write({
        setting: filters.setting.includes(value)
          ? filters.setting.filter((s) => s !== value)
          : [...filters.setting, value],
      }),
    [filters.setting, write],
  );

  const setWhen = useCallback(
    (when: WhenFilter) => write({ when: filters.when === when ? "all" : when }),
    [filters.when, write],
  );

  const selectActivity = useCallback(
    (activityId: string | null) => write({ activityId }),
    [write],
  );

  const reset = useCallback(
    () => write({ age: [], setting: [], when: "all", activityId: null }),
    [write],
  );

  const isFiltered =
    filters.age.length > 0 || filters.setting.length > 0 || filters.when !== "all";

  /** The query string the API expects for the current filters. */
  const apiQuery = useMemo(() => {
    const query = new URLSearchParams();
    if (filters.age.length) query.set("age", filters.age.join(","));
    if (filters.setting.length) query.set("setting", filters.setting.join(","));
    if (filters.when !== "all") query.set("when", filters.when);
    return query.toString();
  }, [filters.age, filters.setting, filters.when]);

  return {
    filters,
    apiQuery,
    isFiltered,
    toggleAge,
    toggleSetting,
    setWhen,
    selectActivity,
    reset,
  };
}
