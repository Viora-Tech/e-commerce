import type { Env } from '@commerce/config'
import { type ErrorReporter, scrubPii } from '@commerce/observability'
import * as Sentry from '@sentry/bun'

/**
 * Error tracking for the worker (GlitchTip via the Sentry SDK). Stays off
 * unless SENTRY_DSN is set. See docs/ops/error-tracking.md, including how to
 * run GlitchTip locally.
 */
export function initSentry(env: Env): void {
  if (!env.SENTRY_DSN) return
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubPii(event),
    beforeSendTransaction: (event) => scrubPii(event),
  })
}

/** Wired into every BullMQ worker via reportWorkerFailures; a no-op when Sentry never initialized. */
export const reportError: ErrorReporter = (error, tags) => {
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags)) scope.setTag(key, value)
    Sentry.captureException(error)
  })
}
