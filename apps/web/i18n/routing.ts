export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, { name: string; nativeName: string; flag: string }> = {
  en: {
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
  },
  ja: {
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
  },
};
