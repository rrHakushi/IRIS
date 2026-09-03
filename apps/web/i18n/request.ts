import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"
import { defaultLocale, locales, type Locale } from "./routing"

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value as
    Locale | undefined
  const locale: Locale =
    cookieLocale && locales.includes(cookieLocale)
      ? cookieLocale
      : defaultLocale

  return {
    locale,
    messages: (await import(`../locales/${locale}.json`)).default,
  }
})
