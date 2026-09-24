import { loadEnv } from '@commerce/config'
import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/sentry-options'

/**
 * Runs once per server/edge runtime on boot. Error tracking (GlitchTip via
 * the Sentry SDK) stays off unless SENTRY_DSN is set — see
 * docs/ops/error-tracking.md for how to run GlitchTip locally.
 */
export async function register() {
  const options = sentryOptions(loadEnv(process.env))
  if (!options) return
  Sentry.init(options)
}

export const onRequestError = Sentry.captureRequestError
