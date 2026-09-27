/**
 * Runs `task` once the page has finished loading and the main thread is idle: the
 * slot for work no shopper is waiting on (third-party widgets, warming a chunk).
 * Browsers without `requestIdleCallback` (Safari) get a short timeout instead.
 * Returns a cancel.
 */
export function afterLoadWhenIdle(task: () => void, timeoutMs = 4000): () => void {
  if (typeof window === 'undefined') return () => {}
  let cancelIdle = () => {}
  const schedule = () => {
    // Typed as always present, but Safari still ships without it.
    const hasIdle =
      (window.requestIdleCallback as typeof window.requestIdleCallback | undefined) !== undefined
    if (hasIdle) {
      const id = window.requestIdleCallback(task, { timeout: timeoutMs })
      cancelIdle = () => window.cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(task, 1500)
      cancelIdle = () => window.clearTimeout(id)
    }
  }
  if (document.readyState === 'complete') {
    schedule()
    return () => cancelIdle()
  }
  window.addEventListener('load', schedule, { once: true })
  return () => {
    window.removeEventListener('load', schedule)
    cancelIdle()
  }
}
