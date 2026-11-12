import { loadEnv, workerPublicUrl } from '@commerce/config'
import { sentryOptions } from '@commerce/observability'
import type { nextLogInstrumentation } from '@commerce/observability/logging/next'
import * as Sentry from '@sentry/nextjs'
import type { Instrumentation } from 'next'

let logs: ReturnType<typeof nextLogInstrumentation> | undefined

/**
 * Runs once per server/edge runtime on boot. Error tracking (GlitchTip via
 * the Sentry SDK) stays off unless SENTRY_DSN is set — see
 * docs/ops/error-tracking.md for how to run GlitchTip locally. Structured
 * logs (evlog) start here too, Node.js runtime only — docs/ops/logging.md.
 */
export async function register() {
  const env = loadEnv(process.env)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Fail at boot, not on a merchant's first webhook page: production needs the worker's
    // public URL (never the localhost fallback). Skipped while `next build` runs.
    if (process.env.NEXT_PHASE !== 'phase-production-build') workerPublicUrl(env)
    const { nextLogInstrumentation } = await import('@commerce/observability/logging/next')
    logs = nextLogInstrumentation('admin', env)
    await logs.register()
  }
  const options = sentryOptions(env)
  if (!options) return
  Sentry.init(options)
}

/** A render or route error no handler caught: to Sentry, and as an error event to the logs. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  Sentry.captureRequestError(error, request, context)
  await logs?.onRequestError(
    error instanceof Error ? error : new Error(String(error)),
    { path: request.path, method: request.method, headers: {} },
    { ...context, renderSource: context.renderSource ?? 'unknown' },
  )
}
