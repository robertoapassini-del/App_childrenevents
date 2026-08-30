"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import type { ActivityKind, Setting } from "@/lib/enums";
import type { IngestResult } from "@/lib/ingest";

/**
 * The submit flow. Its shape follows from one fact: Facebook won't let our
 * server read an event page, so automatic parsing succeeds sometimes and fails
 * often. Every step therefore falls forward — a failed link offers the paste box,
 * a failed parse offers the empty form — and the form is always one tap away
 * regardless. Nothing here is a dead end.
 */

interface DraftForm {
  kind: ActivityKind;
  title: string;
  description: string;
  venueName: string;
  address: string;
  postalCode: string;
  city: string;
  startsAtLocal: string;
  endsAtLocal: string;
  weeklyHours: string;
  alwaysOpen: boolean;
  ageMinMonths: number;
  ageMaxMonths: number;
  priceChf: string;
  isFree: boolean;
  dropIn: boolean;
  setting: Setting;
}

const EMPTY_FORM: DraftForm = {
  kind: "EVENT",
  title: "",
  description: "",
  venueName: "",
  address: "",
  postalCode: "",
  city: "Lausanne",
  startsAtLocal: "",
  endsAtLocal: "",
  weeklyHours: "",
  alwaysOpen: false,
  ageMinMonths: 0,
  ageMaxMonths: 60,
  priceChf: "",
  isFree: false,
  dropIn: true,
  setting: "INDOOR",
};

/** ISO instant → the `datetime-local` value for that moment in Lausanne. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  // sv-SE gives "2026-09-12 10:00"; the input wants a T.
  return parts.replace(" ", "T");
}

function formFromDraft(draft: NonNullable<IngestResult["draft"]>): DraftForm {
  return {
    ...EMPTY_FORM,
    kind: (draft.kind as ActivityKind) ?? "EVENT",
    title: draft.title ?? "",
    description: draft.description ?? "",
    venueName: draft.venueName ?? "",
    address: draft.address ?? "",
    postalCode: draft.postalCode ?? "",
    city: draft.city ?? "Lausanne",
    startsAtLocal: toLocalInput(draft.startsAt),
    endsAtLocal: toLocalInput(draft.endsAt),
    weeklyHours: draft.weeklyHours ?? "",
    ageMinMonths: draft.ageMinMonths ?? 0,
    ageMaxMonths: draft.ageMaxMonths ?? 60,
    priceChf:
      draft.priceCents === null || draft.priceCents === undefined
        ? ""
        : String(draft.priceCents / 100),
    isFree: draft.isFree ?? false,
    dropIn: draft.dropIn ?? true,
    setting: (draft.setting as Setting) ?? "INDOOR",
  };
}

/**
 * A `datetime-local` value is a Lausanne wall-clock time; convert it to a real
 * instant by asking what UTC offset that zone was on at that moment.
 */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const naive = new Date(`${value}:00Z`).getTime();
  if (Number.isNaN(naive)) return null;

  const offsetAt = (instant: number) => {
    const shown = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(instant));
    return new Date(`${shown.replace(" ", "T")}Z`).getTime() - instant;
  };

  const first = offsetAt(naive);
  const candidate = naive - first;
  const second = offsetAt(candidate);
  return new Date(second === first ? candidate : naive - second).toISOString();
}

type Stage = "link" | "text" | "form";

export function AddForm({ parsingAvailable }: { parsingAvailable: boolean }) {
  const { t } = useI18n();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [checkFields, setCheckFields] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function applyResult(result: IngestResult) {
    if (result.draft) setForm(formFromDraft(result.draft));
    setCheckFields(result.checkFields);

    if (result.outcome === "PARSED") {
      setNotice(result.checkFields.length ? t.add.partialResult : null);
      setStage("form");
      return;
    }
    if (result.outcome === "PARSING_DISABLED") {
      setNotice(t.add.noApiKey);
      setStage("form");
      return;
    }
    // NEEDS_TEXT. Three different situations, and telling a parent "we found
    // some of it" when we found nothing is worse than saying nothing at all.
    if (result.loginWall || result.linkKind === "FACEBOOK_EVENT") {
      // A Facebook link that failed almost always failed for the same reason,
      // whether or not we got far enough to see the wall itself.
      setNotice(t.add.facebookWall);
    } else if (result.draft) {
      setNotice(t.add.partialResult);
    } else {
      setNotice(t.add.couldNotRead);
    }
    setStage("text");
  }

  async function submitLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ingest/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        setError(t.field.invalidUrl);
        return;
      }
      applyResult((await response.json()) as IngestResult);
    } catch {
      setError(t.empty.errorHint);
    } finally {
      setBusy(false);
    }
  }

  async function submitText(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ingest/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sourceUrl: url || null }),
      });
      if (!response.ok) {
        setError(t.empty.errorHint);
        return;
      }
      applyResult((await response.json()) as IngestResult);
    } catch {
      setError(t.empty.errorHint);
    } finally {
      setBusy(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const price = form.priceChf.trim()
      ? Math.round(Number.parseFloat(form.priceChf.replace(",", ".")) * 100)
      : null;

    let weeklyHours: unknown = null;
    if (form.kind !== "EVENT" && !form.alwaysOpen && form.weeklyHours.trim()) {
      try {
        weeklyHours = JSON.parse(form.weeklyHours);
      } catch {
        setError(t.field.weeklyHours);
        setBusy(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: form.kind,
          title: form.title,
          description: form.description || null,
          venueName: form.venueName,
          address: form.address,
          city: form.city,
          postalCode: form.postalCode || null,
          startsAt: form.kind === "EVENT" ? localInputToIso(form.startsAtLocal) : null,
          endsAt: form.kind === "EVENT" ? localInputToIso(form.endsAtLocal) : null,
          weeklyHours,
          alwaysOpen: form.alwaysOpen,
          ageMinMonths: form.ageMinMonths,
          ageMaxMonths: form.ageMaxMonths,
          priceCents: form.isFree ? 0 : price,
          isFree: form.isFree,
          dropIn: form.dropIn,
          setting: form.setting,
          sourceType: url ? undefined : "MANUAL",
          sourceUrl: url || null,
        }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          detail?.error === "geocode_failed" ? t.field.required : t.empty.errorHint,
        );
        return;
      }

      const { id } = (await response.json()) as { id: string };
      router.push(`/a/${id}`);
    } catch {
      setError(t.empty.errorHint);
    } finally {
      setBusy(false);
    }
  }

  const flagged = (field: string) => checkFields.includes(field);
  const fieldClass = (field: string) =>
    `mt-1 w-full rounded-2xl border-2 px-3 py-2.5 text-base ${
      flagged(field)
        ? "border-ouistiti-500 bg-ouistiti-50"
        : "border-ouistiti-200 bg-white"
    }`;

  return (
    <div className="space-y-4">
      {notice ? (
        <p className="rounded-2xl border-2 border-ouistiti-300 bg-ouistiti-50 px-3 py-2.5 text-sm font-semibold text-ouistiti-900">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-2xl border-2 border-plum-300 bg-plum-50 px-3 py-2.5 text-sm font-bold text-plum-700">
          {error}
        </p>
      ) : null}

      {stage === "link" ? (
        <form onSubmit={submitLink} className="card space-y-3">
          <div>
            <label htmlFor="url" className="text-sm font-extrabold text-ink">
              {t.add.linkLabel}
            </label>
            <input
              id="url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t.add.linkPlaceholder}
              className="mt-1 w-full rounded-2xl border-2 border-ouistiti-200 bg-white px-3 py-2.5 text-base"
            />
            <p className="mt-1 text-xs text-ink-soft">{t.add.linkHint}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !url}
              className="tap inline-flex items-center rounded-full bg-ouistiti-500 px-5 font-bold text-white disabled:opacity-50"
            >
              {busy ? t.add.parsing : t.add.parseLink}
            </button>
            <button
              type="button"
              onClick={() => setStage("text")}
              className="tap inline-flex items-center rounded-full border-2 border-ouistiti-300 bg-white px-4 text-sm font-bold text-ouistiti-800"
            >
              {t.add.parseText}
            </button>
            <button
              type="button"
              onClick={() => setStage("form")}
              className="tap inline-flex items-center px-2 text-sm font-bold text-ink-soft underline underline-offset-4"
            >
              {t.add.manualEntry}
            </button>
          </div>
        </form>
      ) : null}

      {stage === "text" ? (
        <form onSubmit={submitText} className="card space-y-3">
          <div>
            <label htmlFor="text" className="text-sm font-extrabold text-ink">
              {t.add.textLabel}
            </label>
            <textarea
              id="text"
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.add.textPlaceholder}
              className="mt-1 w-full rounded-2xl border-2 border-ouistiti-200 bg-white px-3 py-2.5 text-base"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || text.trim().length < 20 || !parsingAvailable}
              className="tap inline-flex items-center rounded-full bg-ouistiti-500 px-5 font-bold text-white disabled:opacity-50"
            >
              {busy ? t.add.parsing : t.add.parseText}
            </button>
            <button
              type="button"
              onClick={() => setStage("form")}
              className="tap inline-flex items-center px-2 text-sm font-bold text-ink-soft underline underline-offset-4"
            >
              {t.add.manualEntry}
            </button>
          </div>
          {!parsingAvailable ? (
            <p className="text-xs text-ink-soft">{t.add.noApiKey}</p>
          ) : null}
        </form>
      ) : null}

      {stage === "form" ? (
        <form onSubmit={save} className="card space-y-4">
          <h2 className="text-base font-extrabold text-ink">{t.add.preview}</h2>

          <fieldset>
            <legend className="text-sm font-extrabold text-ink">
              {t.add.kindQuestion}
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["EVENT", "RECURRING", "PLACE"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => set("kind", kind)}
                  aria-pressed={form.kind === kind}
                  className={`pill ${form.kind === kind ? "pill-on" : "pill-off"}`}
                >
                  {t.kind[kind]}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="title" className="text-sm font-extrabold text-ink">
              {t.field.title}
              {flagged("title") ? (
                <span className="ml-1.5 rounded-full bg-ouistiti-200 px-1.5 py-0.5 text-xs">
                  {t.add.checkThis}
                </span>
              ) : null}
            </label>
            <input
              id="title"
              required
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={fieldClass("title")}
            />
          </div>

          <div>
            <label htmlFor="description" className="text-sm font-extrabold text-ink">
              {t.field.description}
            </label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={fieldClass("description")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="venueName" className="text-sm font-extrabold text-ink">
                {t.field.venueName}
              </label>
              <input
                id="venueName"
                required
                value={form.venueName}
                onChange={(e) => set("venueName", e.target.value)}
                className={fieldClass("venueName")}
              />
            </div>
            <div>
              <label htmlFor="address" className="text-sm font-extrabold text-ink">
                {t.field.address}
                {flagged("address") ? (
                  <span className="ml-1.5 rounded-full bg-ouistiti-200 px-1.5 py-0.5 text-xs">
                    {t.add.checkThis}
                  </span>
                ) : null}
              </label>
              <input
                id="address"
                required
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                className={fieldClass("address")}
              />
            </div>
            <div>
              <label htmlFor="postalCode" className="text-sm font-extrabold text-ink">
                {t.field.postalCode}
              </label>
              <input
                id="postalCode"
                inputMode="numeric"
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
                className={fieldClass("postalCode")}
              />
            </div>
            <div>
              <label htmlFor="city" className="text-sm font-extrabold text-ink">
                {t.field.city}
              </label>
              <input
                id="city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className={fieldClass("city")}
              />
            </div>
          </div>

          {form.kind === "EVENT" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="startsAt" className="text-sm font-extrabold text-ink">
                  {t.field.startsAt}
                  {flagged("startsAt") ? (
                    <span className="ml-1.5 rounded-full bg-ouistiti-200 px-1.5 py-0.5 text-xs">
                      {t.add.checkThis}
                    </span>
                  ) : null}
                </label>
                <input
                  id="startsAt"
                  type="datetime-local"
                  required
                  value={form.startsAtLocal}
                  onChange={(e) => set("startsAtLocal", e.target.value)}
                  className={fieldClass("startsAt")}
                />
              </div>
              <div>
                <label htmlFor="endsAt" className="text-sm font-extrabold text-ink">
                  {t.field.endsAt}
                </label>
                <input
                  id="endsAt"
                  type="datetime-local"
                  value={form.endsAtLocal}
                  onChange={(e) => set("endsAtLocal", e.target.value)}
                  className={fieldClass("endsAt")}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="flex items-center gap-2 text-sm font-extrabold text-ink">
                <input
                  type="checkbox"
                  checked={form.alwaysOpen}
                  onChange={(e) => set("alwaysOpen", e.target.checked)}
                  className="h-5 w-5"
                />
                {t.activity.alwaysOpen}
              </label>
              {!form.alwaysOpen ? (
                <div className="mt-2">
                  <label htmlFor="weeklyHours" className="text-sm font-extrabold text-ink">
                    {t.field.weeklyHours}
                  </label>
                  <textarea
                    id="weeklyHours"
                    rows={3}
                    value={form.weeklyHours}
                    onChange={(e) => set("weeklyHours", e.target.value)}
                    placeholder='{"wed":[{"start":"14:00","end":"17:00"}]}'
                    className={`${fieldClass("weeklyHours")} font-mono text-sm`}
                  />
                </div>
              ) : null}
            </div>
          )}

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="text-sm font-extrabold text-ink">
              {t.field.ageRange}
              {flagged("ageRange") ? (
                <span className="ml-1.5 rounded-full bg-ouistiti-200 px-1.5 py-0.5 text-xs">
                  {t.add.checkThis}
                </span>
              ) : null}
            </legend>
            <div>
              <label htmlFor="ageMin" className="text-xs font-bold text-ink-soft">
                {t.field.ageMin}
              </label>
              <input
                id="ageMin"
                type="number"
                min={0}
                max={216}
                value={form.ageMinMonths}
                onChange={(e) => set("ageMinMonths", Number(e.target.value))}
                className={fieldClass("ageRange")}
              />
            </div>
            <div>
              <label htmlFor="ageMax" className="text-xs font-bold text-ink-soft">
                {t.field.ageMax}
              </label>
              <input
                id="ageMax"
                type="number"
                min={1}
                max={216}
                value={form.ageMaxMonths}
                onChange={(e) => set("ageMaxMonths", Number(e.target.value))}
                className={fieldClass("ageRange")}
              />
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="price" className="text-sm font-extrabold text-ink">
                {t.field.price}
              </label>
              <input
                id="price"
                inputMode="decimal"
                disabled={form.isFree}
                value={form.priceChf}
                onChange={(e) => set("priceChf", e.target.value)}
                className={`${fieldClass("price")} disabled:opacity-50`}
              />
            </div>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input
                  type="checkbox"
                  checked={form.isFree}
                  onChange={(e) => set("isFree", e.target.checked)}
                  className="h-5 w-5"
                />
                {t.field.isFree}
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-ink">
                <input
                  type="checkbox"
                  checked={form.dropIn}
                  onChange={(e) => set("dropIn", e.target.checked)}
                  className="h-5 w-5"
                />
                {t.field.dropIn}
              </label>
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-extrabold text-ink">
              {t.field.setting}
            </legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["INDOOR", "OUTDOOR", "EITHER"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("setting", value)}
                  aria-pressed={form.setting === value}
                  className={`pill ${form.setting === value ? "pill-on" : "pill-off"}`}
                >
                  {value === "INDOOR"
                    ? t.activity.indoor
                    : value === "OUTDOOR"
                      ? t.activity.outdoor
                      : "↔"}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            className="tap w-full rounded-full bg-ouistiti-500 px-5 font-extrabold text-white disabled:opacity-50"
          >
            {busy ? t.add.saving : t.add.save}
          </button>
        </form>
      ) : null}
    </div>
  );
}
