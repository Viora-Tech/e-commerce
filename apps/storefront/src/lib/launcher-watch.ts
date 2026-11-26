/**
 * When the Inbox chat button looks at the page again (its lift above bottom bars, the overlay
 * check, the phone tuck). Measuring is not free: `bottomBars` calls `elementsFromPoint` nine times
 * and walks `getComputedStyle` up the tree, and both force a layout. It used to run on every
 * class change anywhere in the page (a MutationObserver on the whole body), and an imported
 * theme's carousels and scroll reveals change classes many times a second: on Waimers' home page
 * on a phone that was about 3 s of style and layout work blamed on the chat module.
 *
 * Now it runs only on what can move a bar or an overlay, always in an animation frame (never
 * inside the observer):
 * - scroll (passive): the tuck every frame it scrolls, the lift once the scroll settles;
 * - resize, load, and once more `REMEASURE_MS` after start (a dock a theme script draws late);
 * - the page's top-level changes: `<html>` and `<body>` class or style (themes mark an open
 *   drawer there), children added to or removed from `<body>` (a cookie banner, a modal);
 * - `open` on any element (`<details>` menus, `<dialog>` drawers);
 * - class or `hidden` on the buying bars themselves (`WATCH_SELECTOR`), and again `SETTLE_MS`
 *   later once their slide-in has run;
 * - a tap or a key (a drawer opened or closed by the shopper), `SETTLE_MS` later.
 *
 * The plain HTML page's chat module (`plain-html/chat-module.ts`) does the same in plain JS.
 */

/** Bars to watch directly: the sticky add-to-cart (shown or not) and bars marked for the chat. */
export const WATCH_SELECTOR = '.sticky-atc, [data-chat-tuck]'

/** A drawer or a sliding bar has finished arriving after this (ms): measure again then. */
export const SETTLE_MS = 350

/** The lift is measured again this long (ms) after the last scroll event. */
export const SCROLL_SETTLE_MS = 150

/** A late-painting theme bar (a dock its script draws) is measured again after this. */
export const REMEASURE_MS = 1500

type Watchers = {
  /** Reads the scroll position and the buying bars; runs in a frame while the page scrolls. */
  tuck: () => void
  /** Reads the bars under the button and the overlay over it; runs in a frame, rarely. */
  measure: () => void
}

/** Starts watching; returns the function that stops it. */
export function watchLauncher({ tuck, measure }: Watchers): () => void {
  let frame = 0
  let wantTuck = false
  let wantMeasure = false
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const watched = new WeakSet<Element>()

  const run = () => {
    frame = 0
    const doMeasure = wantMeasure
    const doTuck = wantTuck
    wantMeasure = false
    wantTuck = false
    if (doMeasure) {
      watchBars()
      measure()
    }
    if (doTuck || doMeasure) tuck()
  }
  const request = (alsoMeasure: boolean) => {
    wantTuck = true
    if (alsoMeasure) wantMeasure = true
    if (!frame) frame = requestAnimationFrame(run)
  }
  const later = (ms: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      request(true)
    }, ms)
    timers.add(timer)
  }
  const settle = () => {
    request(true)
    later(SETTLE_MS)
  }

  let scrollEnd: ReturnType<typeof setTimeout> | undefined
  const handleScroll = () => {
    request(false)
    clearTimeout(scrollEnd)
    scrollEnd = setTimeout(() => request(true), SCROLL_SETTLE_MS)
  }
  const handleMeasure = () => request(true)
  const handleInput = () => later(SETTLE_MS)

  // The page's top level, and `open` anywhere: rare changes, so any of them re-measures.
  const top = new MutationObserver(handleMeasure)
  top.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
  top.observe(document.body, {
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  })
  const opened = new MutationObserver(settle)
  opened.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
  // The buying bars themselves, found again on every measure (a theme may draw one late).
  const bars = new MutationObserver(settle)
  function watchBars() {
    for (const el of document.querySelectorAll(WATCH_SELECTOR)) {
      if (watched.has(el)) continue
      watched.add(el)
      bars.observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] })
    }
  }

  request(true)
  later(REMEASURE_MS)
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleMeasure, { passive: true })
  window.addEventListener('load', handleMeasure)
  document.addEventListener('pointerup', handleInput, { capture: true, passive: true })
  document.addEventListener('keyup', handleInput, { capture: true, passive: true })

  return () => {
    cancelAnimationFrame(frame)
    clearTimeout(scrollEnd)
    for (const timer of timers) clearTimeout(timer)
    top.disconnect()
    opened.disconnect()
    bars.disconnect()
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('resize', handleMeasure)
    window.removeEventListener('load', handleMeasure)
    document.removeEventListener('pointerup', handleInput, { capture: true })
    document.removeEventListener('keyup', handleInput, { capture: true })
  }
}
