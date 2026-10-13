import { createLogger, type LogLevel, type RequestLogger } from 'evlog'

/** Structured fields on a log line. Ids, counts and names only: never an email, phone or body. */
export type LogFields = Record<string, unknown> & {
  /** The caught error; its name, message and stack land under `error`. */
  error?: unknown
}

/** The per-request/per-job wide event, for code that adds fields to one (`log.set({ storeId })`). */
export type WideLogger = RequestLogger

function line(
  level: Extract<LogLevel, 'info' | 'warn' | 'error'>,
  message: string,
  fields?: LogFields,
) {
  const { error, ...rest } = fields ?? {}
  const log = createLogger({ message, ...rest })
  if (error !== undefined) log.error(error instanceof Error ? error : String(error))
  log.setLevel(level)
  // A line is written because something worth reading happened: never sampled away.
  log.emit({ _forceKeep: true })
}

/**
 * SOURCE OF TRUTH KEYWORDS: logger, log line, console replacement
 * WHAT:  One structured log line (message + fields), outside any request or job wide event.
 * WHY:   Replaces `console.*` in server code: the line gets the service, environment and PII
 *        scrubbing of every event, and fields stay searchable instead of interpolated.
 * WHERE: server code in apps/* and packages/*; request/job context goes on the wide event
 *        instead (`useLogger()` in route handlers, `context.log` in oRPC procedures).
 */
export const logger = {
  info: (message: string, fields?: LogFields) => line('info', message, fields),
  warn: (message: string, fields?: LogFields) => line('warn', message, fields),
  error: (message: string, fields?: LogFields) => line('error', message, fields),
}

/** Starts a wide event for one unit of work; the caller sets fields and calls `emit()` once. */
export function startWideEvent(fields: Record<string, unknown>): WideLogger {
  return createLogger(fields)
}
