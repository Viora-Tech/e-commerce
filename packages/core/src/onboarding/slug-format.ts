/** SOURCE OF TRUTH: store address (slug) rules — WHAT the format, length and reserved words a store slug must satisfy / WHY the onboarding form checks them live in the browser and createStore enforces the same rules. No database. */

/**
 * Words that would collide with a platform path or a common expectation
 * (`admin.<domain>`, `api.<domain>`, …). Kept here, not in `@commerce/config`,
 * because it is about the merchant-facing store slug, not the platform's own
 * hostnames (`PLATFORM_DOMAINS` in `@commerce/config` is a different list).
 */
const RESERVED_STORE_SLUGS: readonly string[] = [
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
  // Our own hostnames (infra and tools) under the same parent domain as store addresses.
  'worker',
  'dokploy',
  'panel',
  'maus',
  'umami',
  'analytics',
  'track',
  'metrics',
  'grafana',
  'smtp',
  'imap',
  'pop',
  'ns1',
  'ns2',
  'mx',
  'email',
  'webhooks',
  'hooks',
  'auth',
  'sso',
  'id',
  'cloud',
  'files',
  'media',
  'images',
  'img',
  's3',
  'r2',
  'backup',
  'admin-new',
  'shop-new',
  'dashboard',
  'console',
  'portal',
  'my',
  'go',
  'link',
  'links',
  'l',
  'cdn2',
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
