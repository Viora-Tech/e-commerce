import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const read = () => window.matchMedia(QUERY).matches
/** The server cannot know; hydration renders the motion-allowed markup, then corrects. */
const readOnServer = () => false

/**
 * Whether the visitor asked the OS for reduced motion, kept live. Replaces
 * `motion/react`'s hook so blocks that only need this answer do not pull the
 * animation library into the page's first-load JS.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, read, readOnServer)
}
