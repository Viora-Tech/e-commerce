import { type Locale, mergeCopy, type TranslationPair } from '@/lib/i18n'

/**
 * Hindi overlays by English export. Empty until `loadHindi()` (`lib/hindi.ts`) adds
 * `data/hi`: the overlays are about 200 kB gzip, so they are not part of any page's JS and an
 * English member never downloads them.
 */
const hindi = new Map<unknown, unknown>()
/** One merged object per English export, so a Hindi render reuses the same references. */
const merged = new WeakMap<object, unknown>()

/**
 * `en` in `locale`: the English export itself, or its Hindi overlay merged over it key by
 * key when `data/hi/index.ts` registers one. Exports without a Hindi file stay English.
 * Works anywhere (server, client, plain helpers) once the overlays are loaded: `getLocale()`
 * loads them on the server and `LocaleProvider` in the browser, before anything renders in
 * Hindi. Components use `useCopy` or `getCopy`.
 */
export function localize<T>(en: T, locale: Locale): T {
  if (locale === 'en') return en
  const hi = hindi.get(en)
  if (hi === undefined || typeof en !== 'object' || en === null) {
    return hi === undefined ? en : mergeCopy(en, hi)
  }
  const cached = merged.get(en)
  if (cached !== undefined) return cached as T
  const out = mergeCopy(en, hi)
  merged.set(en, out)
  return out
}

/** Adds Hindi overlays; `lib/hindi.ts` calls it once `data/hi` has loaded. */
export function addTranslations(pairs: readonly TranslationPair[]): void {
  for (const [en, hi] of pairs) hindi.set(en, hi)
}

/** Whether `en` has a registered Hindi translation (for tests and the coverage report). */
export function hasTranslation(en: unknown): boolean {
  return hindi.has(en)
}
