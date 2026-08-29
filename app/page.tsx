import { Suspense } from "react";
import { listActivities } from "@/lib/activities";
import { ActivityQuery } from "@/lib/schemas";
import { MapScreen } from "@/components/map-screen";

export const dynamic = "force-dynamic";

/**
 * The map is rendered server-side with the filters already applied, so a shared
 * link opens on the right view rather than flashing an unfiltered map first.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const query = ActivityQuery.safeParse({
    age: first("age"),
    setting: first("setting"),
    when: first("when"),
    kind: first("kind"),
    q: first("q"),
  });

  const activities = await listActivities(
    query.success
      ? query.data
      : { age: [], setting: [], when: "all", kind: [], limit: 100 },
  );

  return (
    <Suspense>
      <MapScreen initialActivities={activities} />
    </Suspense>
  );
}
