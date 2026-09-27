/**
 * Admin languages: English is the source (every `data/<feature>.ts`), Hindi is a typed overlay
 * (`data/hi/<feature>.ts`) merged over it key by key. Pure and client-safe; the registry of
 * Hindi files is `data/hi/index.ts`, and `lib/copy.ts` / `hooks/use-copy.ts` put the two
 * together. How to add or translate copy: developer docs, Building, "Admin languages".
 */

export const LOCALES = ['en', 'hi'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

/** The cookie that remembers the member's admin language, read by the root layout. */
export const LOCALE_COOKIE = 'admin_locale'
/** One year: a language choice is long-lived. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** BCP 47 tag for `Intl` and `@commerce/money`: Indian English or Hindi (India). */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-IN', hi: 'hi-IN' }

/** A cookie (or any untrusted) value as a locale; anything unknown is English. */
export function parseLocale(value: string | null | undefined): Locale {
  return (LOCALES as readonly string[]).includes(value ?? '') ? (value as Locale) : DEFAULT_LOCALE
}

/** The `Set-Cookie`-style string that stores `locale` for a year on every admin path. */
export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
}

/** The locale stored in a `Cookie` header (`a=1; admin_locale=hi`), English when absent. */
export function localeFromCookieHeader(header: string | null | undefined): Locale {
  const pair = (header ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
  return parseLocale(pair?.slice(LOCALE_COOKIE.length + 1))
}

/**
 * Marks a key (or a whole group) as deliberately left in English for now. The type below
 * makes every English key required in a Hindi file, so nothing goes missing silently; this
 * is the explicit way to say "not yet". `rg untranslated apps/admin/src/data/hi` lists them.
 */
export const untranslated: unique symbol = Symbol('untranslated')
export type Untranslated = typeof untranslated

/**
 * The Hindi shape of an English copy value: same keys (all required, no extras), strings
 * stay strings, functions keep their parameters (`(n: number) => string` must be answered
 * with a function of the same signature), arrays keep their length when they are tuples.
 */
export type Translation<T> = T extends string
  ? string | Untranslated
  : T extends (...args: infer A) => infer R
    ? ((...args: A) => R) | Untranslated
    : T extends readonly unknown[]
      ? { -readonly [K in keyof T]: Translation<T[K]> } | Untranslated
      : T extends object
        ? { -readonly [K in keyof T]: Translation<T[K]> } | Untranslated
        : T

/** One English value and its Hindi overlay, as registered in `data/hi/index.ts`. */
export type TranslationPair = readonly [en: unknown, hi: unknown]

/**
 * Pairs an English export with its Hindi translation. The Hindi argument is checked against
 * the English value's shape: a missing key, an extra key or a wrong kind (text where the
 * English has a function) is a type error.
 */
export function translation<T>(en: T, hi: NoInfer<Translation<T>>): TranslationPair {
  return [en, hi]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  // React components made by forwardRef/memo are plain objects too: treat them as values.
  if ('$$typeof' in value) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * The English value with every Hindi key that is present and of the same kind laid over it.
 * Missing, `untranslated` or mismatched keys keep their English value; keys the English does
 * not have are dropped; arrays keep the English length.
 */
export function mergeCopy<T>(en: T, hi: unknown): T {
  if (hi === undefined || hi === null || hi === untranslated) return en
  if (typeof en === 'string') return (typeof hi === 'string' ? hi : en) as T
  if (typeof en === 'function') return (typeof hi === 'function' ? hi : en) as T
  if (Array.isArray(en)) {
    if (!Array.isArray(hi)) return en
    return en.map((item, i) => mergeCopy(item, hi[i])) as T
  }
  if (isPlainObject(en)) {
    if (!isPlainObject(hi)) return en
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(en)) out[key] = mergeCopy(en[key], hi[key])
    return out as T
  }
  return (typeof hi === typeof en ? hi : en) as T
}

/** A problem `translationProblems` found, with the dotted path to it. */
export type TranslationProblem = { path: string; kind: 'unknown' | 'mismatch' }

/**
 * Keys in the Hindi overlay that the English does not have, or whose kind differs (text vs
 * function vs group). The type already rejects these; this catches casts and `any`.
 */
export function translationProblems(en: unknown, hi: unknown, path = ''): TranslationProblem[] {
  if (hi === undefined || hi === untranslated) return []
  const kindOf = (v: unknown) =>
    Array.isArray(v) ? 'array' : isPlainObject(v) ? 'object' : typeof v
  if (kindOf(en) !== kindOf(hi)) return [{ path: path || '(root)', kind: 'mismatch' }]
  if (Array.isArray(en) && Array.isArray(hi)) {
    const extra = hi.slice(en.length).map((_, i) => ({
      path: `${path}[${en.length + i}]`,
      kind: 'unknown' as const,
    }))
    return [
      ...hi.slice(0, en.length).flatMap((v, i) => translationProblems(en[i], v, `${path}[${i}]`)),
      ...extra,
    ]
  }
  if (isPlainObject(en) && isPlainObject(hi)) {
    return Object.keys(hi).flatMap((key) => {
      const at = path ? `${path}.${key}` : key
      if (!(key in en)) return [{ path: at, kind: 'unknown' as const }]
      return translationProblems(en[key], hi[key], at)
    })
  }
  return []
}

/** Dotted paths of English keys the Hindi leaves in English (missing or `untranslated`). */
export function untranslatedPaths(en: unknown, hi: unknown, path = ''): string[] {
  if (hi === undefined || hi === null || hi === untranslated) return [path || '(root)']
  if (Array.isArray(en) && Array.isArray(hi)) {
    return en.flatMap((v, i) => untranslatedPaths(v, hi[i], `${path}[${i}]`))
  }
  if (isPlainObject(en) && isPlainObject(hi)) {
    return Object.keys(en).flatMap((key) =>
      untranslatedPaths(en[key], hi[key], path ? `${path}.${key}` : key),
    )
  }
  return []
}
