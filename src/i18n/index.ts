export const locales = [
  'en', 'hi', 'bn', 'as', 'es', 'pt', 'fr', 'ar', 'ur', 'zh',
  'ja', 'ko', 'ru', 'id', 'de', 'tr', 'it', 'vi', 'th', 'ta',
] as const;

export type Locale = (typeof locales)[number];

export const rtlLocales: Locale[] = ['ar', 'ur'];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  bn: 'বাংলা',
  as: 'অসমীয়া',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  ar: 'العربية',
  ur: 'اردو',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ru: 'Русский',
  id: 'Bahasa Indonesia',
  de: 'Deutsch',
  tr: 'Türkçe',
  it: 'Italiano',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  ta: 'தமிழ்',
};

export function isRtl(locale: string): boolean {
  return (rtlLocales as string[]).includes(locale);
}

/** "/hi/maker" -> { locale: "hi", path: "/maker" } ; unknown prefix -> en */
export function parseLocale(url: URL): { locale: Locale; path: string } {
  const seg = url.pathname.split('/').filter(Boolean)[0];
  if ((locales as readonly string[]).includes(seg)) {
    return { locale: seg as Locale, path: '/' + url.pathname.split('/').filter(Boolean).slice(1).join('/') };
  }
  return { locale: 'en', path: url.pathname };
}

export function localizedPath(locale: string, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean === '/' ? '/' : clean}`;
}

/** Internal navigation href — prepends the deploy base path (e.g. /ricsline) */
export function link(locale: string, path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '');
  return `${base}${localizedPath(locale, path)}`;
}

/** Base-aware asset URL — works when the site is served from a subpath */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return `${base}${path.replace(/^\//, '')}`;
}

/** Alternate hreflang URLs for every locale */
export function alternateLinks(site: string, path: string): { locale: Locale; href: string }[] {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return locales.map((locale) => ({
    locale,
    href: `${site}/${locale}${clean === '/' ? '/' : clean}`,
  }));
}
