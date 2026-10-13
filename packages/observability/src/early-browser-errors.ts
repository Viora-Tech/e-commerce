/** The parts of a window `error` / `unhandledrejection` event read here; structural, no DOM lib. */
type EarlyErrorEvent = {
  readonly type: string
  error?: unknown
  message?: unknown
  reason?: unknown
}

/** The window, as far as this file needs it. */
export type ErrorEventTarget = {
  addEventListener(
    type: 'error' | 'unhandledrejection',
    listener: (e: EarlyErrorEvent) => void,
  ): void
  removeEventListener(
    type: 'error' | 'unhandledrejection',
    listener: (e: EarlyErrorEvent) => void,
  ): void
}

export type EarlyBrowserErrors = {
  /** Stops listening and hands each held error to `capture`, oldest first. */
  flush: (capture: (error: unknown) => void) => void
  /** Stops listening and forgets what was held (no DSN: nothing will be sent). */
  stop: () => void
}

const MAX_HELD = 10

/**
 * Holds the uncaught errors a page throws before the Sentry SDK is running (the storefront
 * loads it after the page is idle; the admin waits for the config tag to be parsed), so they
 * are still reported once it starts. At most 10, the rest are dropped.
 */
export function queueEarlyBrowserErrors(target: ErrorEventTarget): EarlyBrowserErrors {
  let held: unknown[] = []
  const onError = (e: EarlyErrorEvent) => {
    if (held.length < MAX_HELD) held.push(e.error ?? e.message)
  }
  const onRejection = (e: EarlyErrorEvent) => {
    if (held.length < MAX_HELD) held.push(e.reason)
  }
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)

  const stop = () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
    const out = held
    held = []
    return out
  }
  return {
    flush: (capture) => {
      for (const error of stop()) capture(error)
    },
    stop: () => {
      stop()
    },
  }
}
