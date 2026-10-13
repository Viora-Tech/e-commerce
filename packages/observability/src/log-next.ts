import { createEvlog } from 'evlog/next'
import { createInstrumentation } from 'evlog/next/instrumentation/create'
import { type LogEnv, type LogService, logOptions } from './log-options'
import { scrubLogEvent } from './scrub-log-event'

/**
 * evlog's Next.js `register`/`onRequestError` pair, configured from `logOptions`. `register`
 * starts the logger and locks it, so `createEvlog()` in a route module cannot replace this
 * config (and drop the drain); `onRequestError` logs render and route errors that no
 * `withEvlog` handler caught. Node.js runtime only: import it dynamically from
 * `instrumentation.ts` behind `process.env.NEXT_RUNTIME === 'nodejs'`.
 */
export function nextLogInstrumentation(service: LogService, env: LogEnv) {
  const { env: context, ...options } = logOptions(service, env)
  return createInstrumentation({ ...options, service, env: context })
}

/**
 * `withEvlog` turns a route handler's request into one wide event (method, path, status,
 * duration, error); `useLogger()` inside it adds fields. The config itself comes from
 * `nextLogInstrumentation`, which locks the logger first; these options only apply when a
 * route module loads before that (a build step), and keep the PII scrub even then. The
 * storefront's proxy names the store in `x-store-id`; it becomes the event's `storeId`.
 */
export function nextRequestLogging(service: LogService) {
  const { withEvlog, useLogger } = createEvlog({
    service,
    redact: { builtins: false, transform: scrubLogEvent },
    enrich: ({ event, headers }) => {
      const storeId = headers?.['x-store-id']
      if (storeId && event.storeId === undefined) event.storeId = storeId
    },
  })
  return { withEvlog, useLogger }
}
