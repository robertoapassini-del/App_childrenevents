import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivity } from "@/lib/activities";
import { formatAgeRange } from "@/lib/age";
import { getDictionary, localizedField } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { ActivityDetailBody } from "@/components/activity-detail";

export const dynamic = "force-dynamic";

/**
 * The shareable page. Ouistiti spreads by parents pasting links into WhatsApp
 * groups, so this exists as a real server-rendered URL with proper OpenGraph
 * tags — a link that unfurls into a titled card gets opened; a bare URL doesn't.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) return { title: "…" };

  const locale = await getLocale();
  const title =
    localizedField(activity.title, activity.titleEn, locale) ?? activity.title;
  const description =
    localizedField(activity.description, activity.descriptionEn, locale) ??
    `${activity.venueName}, ${activity.city} · ${formatAgeRange(activity, locale)}`;

  return {
    title,
    description,
    openGraph: {
      type: "article",
      title: `${title} · Ouistiti`,
      description,
      url: `/a/${activity.id}`,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) notFound();

  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pt-3 pb-10">
      <Link
        href="/"
        className="tap inline-flex items-center gap-1.5 text-sm font-bold text-ouistiti-700 hover:underline"
      >
        <span aria-hidden="true">←</span>
        {t.nav.backToMap}
      </Link>

      <main id="main" className="card mt-3">
        <ActivityDetailBody activity={activity} />
      </main>

      <p className="mt-4 text-center text-xs text-ink-soft">
        {t.appName} · {t.tagline}
      </p>
    </div>
  );
}
