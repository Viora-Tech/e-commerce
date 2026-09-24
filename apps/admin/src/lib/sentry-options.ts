import type { Env } from '@commerce/config'
import { scrubPii } from '@commerce/observability'
import type { init } from '@sentry/nextjs'

type SentryInitOptions = Parameters<typeof init>[0]

/**
 * Shared server/edge Sentry options. Returns `undefined` when no DSN is set,
 * so `instrumentation.ts` can skip `Sentry.init` entirely — error tracking
 * stays fully off until a GlitchTip DSN is configured. See
 * docs/ops/error-tracking.md.
 */
export function sentryOptions(env: Env): SentryInitOptions | undefined {
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
