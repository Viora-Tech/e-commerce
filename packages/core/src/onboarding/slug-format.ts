/** Browser-safe store slug rules: format, reserved words. No database. */

/**
 * Words that would collide with a platform path or a common expectation
 * (`admin.<domain>`, `api.<domain>`, …). Kept here, not in `@commerce/config`,
 * because it is about the merchant-facing store slug, not the platform's own
 * hostnames (`PLATFORM_DOMAINS` in `@commerce/config` is a different list).
 */
export const RESERVED_STORE_SLUGS: readonly string[] = [
  'admin',
  'api',
  'www',
  'app',
  'mail',
  'shop',
  'store',
  'help',
  'support',
  'docs',
  'status',
  'cdn',
  'assets',
  'static',
  'dev',
  'staging',
  'platform',
  'blog',
  'about',
  'billing',
  'account',
  'accounts',
  'login',
  'signup',
  'onboarding',
  'waitlist',
  'localhost',
  'test',
  'null',
  'undefined',
]

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const SLUG_MIN = 3
export const SLUG_MAX = 40

export type SlugProblem = 'too_short' | 'too_long' | 'invalid_chars' | 'reserved' | 'taken'

/** Turns a store name into a candidate slug: lower-case, hyphenated, ascii only. */
export function slugifyStoreName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
}

/** Format and reserved-word checks only; does not touch the database. */
export function slugFormatProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN) return 'too_short'
  if (slug.length > SLUG_MAX) return 'too_long'
  if (!SLUG_PATTERN.test(slug)) return 'invalid_chars'
  if (RESERVED_STORE_SLUGS.includes(slug)) return 'reserved'
  return null
}

export type SlugAvailability = { available: boolean; problem: SlugProblem | null }
