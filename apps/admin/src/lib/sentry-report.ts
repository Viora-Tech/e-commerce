import type { ErrorReporter } from '@commerce/observability'
import * as Sentry from '@sentry/nextjs'

/**
 * Wired into ApiContext.reportError; captures an unexpected oRPC procedure
 * error with tags only (store id, never customer data). A no-op when
 * SENTRY_DSN is unset, since Sentry.init never ran.
 */
export const reportError: ErrorReporter = (error, tags) => {
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags)) scope.setTag(key, value)
    Sentry.captureException(error)
  })
}
