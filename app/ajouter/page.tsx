import type { Metadata } from "next";
import Link from "next/link";
import { AddForm } from "@/components/add-form";
import { getDictionary } from "@/lib/i18n";
import { isParsingAvailable } from "@/lib/ingest";
import { getLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ajouter une sortie",
};

export default async function AddPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pt-3 pb-12">
      <Link
        href="/"
        className="tap inline-flex items-center gap-1.5 text-sm font-bold text-ouistiti-700 hover:underline"
      >
        <span aria-hidden="true">←</span>
        {t.nav.backToMap}
      </Link>

      <main id="main" className="mt-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {t.add.title}
        </h1>
        <p className="mt-1 mb-4 text-sm text-ink-soft">{t.add.subtitle}</p>

        {/* Whether the model is reachable is a server fact; the form needs it to
            decide between offering a parse and going straight to manual entry. */}
        <AddForm parsingAvailable={isParsingAvailable()} />
      </main>
    </div>
  );
}
