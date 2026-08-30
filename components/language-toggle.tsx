"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";

/**
 * The label shows the language you'd switch *to*, not the one you're in — the
 * usual convention, and the one that needs no explaining.
 */
export function LanguageToggle() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = locale === "fr" ? "en" : "fr";
    fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    })
      .then(() => startTransition(() => router.refresh()))
      .catch(() => {
        // Staying in the current language is a survivable outcome.
      });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="tap inline-flex items-center rounded-full border-2 border-ouistiti-200 bg-white px-3 text-sm font-bold text-ink-soft hover:bg-ouistiti-50 disabled:opacity-60"
    >
      {t.nav.language}
    </button>
  );
}
