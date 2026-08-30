import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

export default async function NotFound() {
  const t = getDictionary(await getLocale());

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-5xl" aria-hidden="true">
          🐒
        </p>
        <h1 className="mt-3 text-xl font-extrabold text-ink">
          {t.empty.noResults}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{t.empty.errorHint}</p>
        <Link
          href="/"
          className="tap mt-5 inline-flex items-center rounded-full bg-ouistiti-500 px-5 font-bold text-white hover:bg-ouistiti-600"
        >
          {t.nav.backToMap}
        </Link>
      </div>
    </main>
  );
}
