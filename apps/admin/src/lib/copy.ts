import { hindiCopy } from '@/data/hi'
import { type Locale, mergeCopy } from '@/lib/i18n'

const hindi = new Map<unknown, unknown>(hindiCopy)
/** One merged object per English export, so a Hindi render reuses the same references. */
const merged = new WeakMap<object, unknown>()

/**
 * `en` in `locale`: the English export itself, or its Hindi overlay merged over it key by
 * key when `data/hi/index.ts` registers one. Exports without a Hindi file stay English.
 * Works anywhere (server, client, plain helpers); components use `useCopy` or `getCopy`.
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

/** Whether `en` has a registered Hindi translation (for tests and the coverage report). */
export function hasTranslation(en: unknown): boolean {
  return hindi.has(en)
}
