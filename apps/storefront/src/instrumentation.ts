import { loadEnv } from '@commerce/config'
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
    const { nextLogInstrumentation } = await import('@commerce/observability/logging/next')
    logs = nextLogInstrumentation('storefront', env)
    await logs.register()
    // The product search engine is chosen once per process, before any page runs, so no page
    // searches with SQL just because the search page has not loaded yet.
    const { registerSearchEngine } = await import('./lib/search-engine-register')
    registerSearchEngine()
    // Memory every ten minutes, so a slow leak shows in the logs before it crashes the process.
    const { startMemoryReport } = await import('./lib/memory-report')
    startMemoryReport()
    // A new build may be live: the worker purges pages a CDN still holds, which point at the old
    // build's scripts (`apps/worker/src/edge-purge.ts`). Never holds up the boot.
    const { announceStorefrontStart } = await import('@commerce/db')
    void announceStorefrontStart(env.DATABASE_URL_DIRECT ?? env.DATABASE_URL).catch(() => undefined)
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
