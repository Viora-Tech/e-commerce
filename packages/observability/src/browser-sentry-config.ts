import type { Env } from '@commerce/config'

/** What the browser needs to report errors; a DSN is public by design, nothing else from env is. */
export type BrowserSentryConfig = {
  dsn: string
  environment: string
  release: string | undefined
}

/** The `<meta name>` the root layout renders and `instrumentation-client.ts` reads. */
export const BROWSER_SENTRY_META = 'sentry-browser'

/**
 * SOURCE OF TRUTH KEYWORDS: BrowserSentryConfig, BROWSER_SENTRY_META, browserSentryMeta,
 *        readBrowserSentryConfig, SENTRY_DSN
 * WHAT:  Hands the browser its GlitchTip DSN, environment and release at request time, as one
 *        `<meta>` tag the root layout renders; `undefined` when no DSN is set, so no tag is
 *        rendered and the browser never starts the SDK.
 * WHY:   Docker images are built once and SENTRY_DSN is set at deploy, so a `NEXT_PUBLIC_*`
 *        value baked at build would be empty or wrong. A meta tag runs no script, so the nonce
 *        script CSP has nothing to allow.
 * WHERE: admin `app/layout.tsx`, storefront `app/-s/[storeId]/layout.tsx`; read back in each
 *        app's `instrumentation-client.ts`. See docs/ops/error-tracking.md, "Browser errors".
 */
export function browserSentryMeta(
  env: Pick<Env, 'SENTRY_DSN' | 'SENTRY_ENVIRONMENT' | 'SENTRY_RELEASE'>,
): { name: string; content: string } | undefined {
  if (!env.SENTRY_DSN) return undefined
  const config: BrowserSentryConfig = {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: env.SENTRY_RELEASE,
  }
  return { name: BROWSER_SENTRY_META, content: JSON.stringify(config) }
}

/** The meta tag's `content` back as a config, or `undefined` when it is missing or malformed. */
export function readBrowserSentryConfig(
  content: string | null | undefined,
): BrowserSentryConfig | undefined {
  if (!content) return undefined
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    return undefined
  }
  if (!value || typeof value !== 'object') return undefined
  const { dsn, environment, release } = value as Record<string, unknown>
  if (typeof dsn !== 'string' || !/^https?:\/\//.test(dsn)) return undefined
  if (typeof environment !== 'string' || !environment) return undefined
  return { dsn, environment, release: typeof release === 'string' ? release : undefined }
}
