import type { Env } from '@commerce/config'
import { scrubPii } from './scrub-pii'

/** The subset of Sentry's `init` options every app sets; structural, so no SDK dependency here. */
export type SentryOptions = {
  dsn: string
  environment: string
  release: string | undefined
  tracesSampleRate: number
  beforeSend: <T>(event: T) => T
  beforeSendTransaction: <T>(event: T) => T
}

/**
 * SOURCE OF TRUTH KEYWORDS: sentryOptions, SENTRY_DSN, tracesSampleRate, scrubPii
 * WHAT:  The server/edge Sentry (GlitchTip) options for every Next app; `undefined` when
 *        no DSN is set so `instrumentation.ts` skips `Sentry.init` entirely.
 * WHY:   Admin and storefront had identical copies; sample rate and PII scrubbing must not
 *        drift between apps. Structural type so this package stays SDK-free.
 * WHERE: apps/admin and apps/storefront `instrumentation.ts`; see docs/ops/error-tracking.md.
 */
export function sentryOptions(
  env: Pick<Env, 'SENTRY_DSN' | 'SENTRY_ENVIRONMENT' | 'SENTRY_RELEASE'>,
): SentryOptions | undefined {
  if (!env.SENTRY_DSN) return undefined
  return {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubPii(event),
    beforeSendTransaction: (event) => scrubPii(event),
  }
}
