'use client'

import { useEffect } from 'react'

const STREAM_POLL_MS = 50
const STREAM_WAIT_MS = 5000

declare global {
  interface Window {
    /** Set by the imported theme's shim (`lib/liquid-shim.ts`): runs its parked scripts. */
    __commerceBootTheme?: () => Promise<void>
    /** React's queue of streamed parts waiting to be put in place (its inline reveal script). */
    $RB?: unknown[]
  }
}

/** Whether React still has streamed sections to put in place (`<template id="B:…">` markers). */
function streaming(): boolean {
  return document.querySelector('template[id^="B:"]') !== null || (window.$RB?.length ?? 0) > 0
}

/**
 * Runs `fn` once the whole page has been parsed and every streamed section is in place (React
 * moves a streamed part into the page shortly after it arrives, batching reveals for up to a
 * few hundred milliseconds, so `DOMContentLoaded` can come first), then after one more task.
 * Not `load`: that waits for every image, and the theme's reveals keep content hidden until its
 * scripts run. Timers, not requestAnimationFrame: a frame never comes in a background tab. In a
 * background tab React's reveal itself waits for a frame, so the wait holds until the tab shows;
 * once visible it gives up after `STREAM_WAIT_MS` rather than leave the theme unstarted.
 */
function afterParse(fn: () => void): () => void {
  let timer = 0
  let waited = 0
  const check = () => {
    if (!streaming() || waited >= STREAM_WAIT_MS) {
      timer = window.setTimeout(fn, 0)
      return
    }
    if (!document.hidden) waited += STREAM_POLL_MS
    timer = window.setTimeout(check, STREAM_POLL_MS)
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', check, { once: true })
  else check()
  return () => {
    document.removeEventListener('DOMContentLoaded', check)
    window.clearTimeout(timer)
  }
}

/**
 * Starts an imported Shopify theme's deferred scripts once React has hydrated the page (see
 * `lib/liquid-defer.ts` for why they wait): after this layout's effects, once the page is
 * fully parsed, its streamed sections are in place and one more task has run. Draws nothing.
 */
export default function LiquidBoot() {
  // Hooks
  useEffect(() => afterParse(() => void window.__commerceBootTheme?.().catch(() => undefined)), [])

  // Render logic
  return null
}
