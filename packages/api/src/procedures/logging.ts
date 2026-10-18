import { startWideEvent, type WideLogger } from '@commerce/observability/logging'
import { ORPCError, os } from '@orpc/server'

/** What `procedureLog` adds to every procedure's context: the call's wide event. */
export type LogContext = { log: WideLogger }

/**
 * SOURCE OF TRUTH KEYWORDS: procedureLog, oRPC wide event, procedure logging
 * WHAT:  One wide event per procedure call, over HTTP (`/api/rpc`) or a server-side `call()`:
 *        the procedure path, duration and outcome, plus the storeId, userId and role the auth
 *        middlewares add (`context.log.set`). An `ORPCError` below 500 (validation, forbidden,
 *        not found) is `rejected` at warn level with its code; anything else is an `error`.
 * WHY:   Admin server pages call procedures directly, so an HTTP request log alone would miss
 *        most of them; one event per call is the searchable record of what a member did.
 * WHERE: `base` in procedures/base.ts (so every procedure has it); docs/ops/logging.md.
 */
export const procedureLog = os.middleware(async ({ path, next }) => {
  const log = startWideEvent({ procedure: path.join('.') })
  try {
    const result = await next({ context: { log } satisfies LogContext })
    log.set({ outcome: 'ok', status: 200 })
    return result
  } catch (error) {
    if (error instanceof ORPCError && error.status < 500) {
      log.warn(error.code, { outcome: 'rejected', status: error.status, errorCode: error.code })
    } else {
      const code = error instanceof ORPCError ? error.code : 'INTERNAL_SERVER_ERROR'
      log.error(error instanceof Error ? error : String(error), {
        outcome: 'error',
        status: error instanceof ORPCError ? error.status : 500,
        errorCode: code,
      })
    }
    throw error
  } finally {
    log.emit()
  }
})
