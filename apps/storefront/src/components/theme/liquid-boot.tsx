'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    /** Set by the imported theme's shim (`lib/liquid-shim.ts`): runs its parked scripts. */
    __commerceBootTheme?: () => Promise<void>
  }
}

/**
 * Runs `fn` once the whole page has been parsed (every streamed part has arrived, so it has
 * hydrated too) and the task queue has had a turn. Not `load`: that waits for every image,
 * and the theme's reveals keep content hidden until its scripts run. A timer, not
 * requestAnimationFrame: a frame never comes in a background tab.
 */
function afterParse(fn: () => void): () => void {
  let timer = 0
  const go = () => {
    timer = window.setTimeout(fn, 0)
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', go, { once: true })
  else go()
  return () => {
    document.removeEventListener('DOMContentLoaded', go)
    window.clearTimeout(timer)
  }
}

/**
 * Starts an imported Shopify theme's deferred scripts once React has hydrated the page (see
 * `lib/liquid-defer.ts` for why they wait): after this layout's effects, once the page is
 * fully parsed and one more task has run. Draws nothing.
 */
export default function LiquidBoot() {
  // Hooks
  useEffect(() => afterParse(() => void window.__commerceBootTheme?.().catch(() => undefined)), [])

  // Render logic
  return null
}
