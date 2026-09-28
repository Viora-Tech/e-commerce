/**
 * Motion's vanilla API (`animate`, `inView`, `stagger`), fetched the first time a
 * block needs it instead of shipping in every page's first-load JS. Blocks render
 * their resting state on the server and without script; motion only ever adds the
 * entrance or loop on top, so a late (or failed) load never hides content.
 */
import { afterLoadWhenIdle } from './idle'

type Motion = typeof import('motion')

let pending: Promise<Motion> | null = null

/** The shared, cached import. A failed fetch clears the cache so a later call can retry. */
export function loadMotion(): Promise<Motion> {
  pending ??= import('motion').catch((error: unknown) => {
    pending = null
    throw error
  })
  return pending
}

/**
 * Starts fetching motion once the page has loaded and the browser is idle, so the
 * first tap on something animated (the mobile menu) rarely waits on the network.
 * Returns a cancel.
 */
export function preloadMotionWhenIdle(): () => void {
  return afterLoadWhenIdle(() => {
    loadMotion().catch(() => {})
  })
}
