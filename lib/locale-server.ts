import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./i18n";

/**
 * Work out the visitor's language on the server, so the first paint is already in
 * the right one — no flash of French for an English reader.
 */
export async function getLocale(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<Locale> {
  const [jar, headerList] = await Promise.all([cookies(), headers()]);
  const raw = searchParams?.lang;
  const param = Array.isArray(raw) ? raw[0] : raw;

  return resolveLocale({
    param,
    cookie: jar.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
}
