// @vitest-environment jsdom
import { DEFAULT_INBOX_WIDGET } from '@commerce/core/inbox'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  REMEASURE_MS,
  SCROLL_SETTLE_MS,
  SETTLE_MS,
  WATCH_SELECTOR,
  watchLauncher,
} from './launcher-watch'
import { chatModuleSpec } from './plain-html/chat-launcher'
import { CHAT_MODULE } from './plain-html/chat-module'

// jsdom has no layout; the frame queue is run by hand so each test sees how many frames ran.
let frames: FrameRequestCallback[] = []
const flushFrames = () => {
  const now = frames
  frames = []
  for (const run of now) run(0)
}

let stop: () => void = () => {}
const tuck = vi.fn()
const measure = vi.fn()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  frames = []
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => frames.push(run))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  document.body.innerHTML =
    '<div class="carousel"><div class="slide"></div></div><div class="sticky-atc"></div>'
  tuck.mockClear()
  measure.mockClear()
  stop = watchLauncher({ tuck, measure })
  flushFrames()
  tuck.mockClear()
  measure.mockClear()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** MutationObserver callbacks run as microtasks: let them run (timers stay fake). */
async function settleMutations() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('watchLauncher', () => {
  it('does not look at the page when a carousel deep in the theme changes its classes', async () => {
    const slide = document.querySelector('.slide') as HTMLElement
    for (let i = 0; i < 20; i++) slide.classList.toggle('is-active')
    document.querySelector('.carousel')?.appendChild(document.createElement('div'))
    await settleMutations()
    flushFrames()
    expect(measure).not.toHaveBeenCalled()
    expect(tuck).not.toHaveBeenCalled()
  })

  it('never measures inside the observer: only in the next animation frame', async () => {
    document.body.classList.add('drawer-open')
    await settleMutations()
    expect(measure).not.toHaveBeenCalled()
    flushFrames()
    expect(measure).toHaveBeenCalledTimes(1)
  })

  it('tucks once per frame while scrolling and measures once the scroll settles', () => {
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('scroll'))
    flushFrames()
    expect(tuck).toHaveBeenCalledTimes(1)
    expect(measure).not.toHaveBeenCalled()
    vi.advanceTimersByTime(SCROLL_SETTLE_MS)
    flushFrames()
    expect(measure).toHaveBeenCalledTimes(1)
  })

  it('measures when a buying bar shows, and again once it has slid in', async () => {
    document.querySelector('.sticky-atc')?.classList.add('is-visible')
    await settleMutations()
    flushFrames()
    expect(measure).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(SETTLE_MS)
    flushFrames()
    expect(measure).toHaveBeenCalledTimes(2)
  })

  it('measures when a menu opens, a banner is added, the window resizes or after a tap', async () => {
    const details = document.createElement('details')
    document.querySelector('.carousel')?.appendChild(details)
    await settleMutations()
    details.open = true
    await settleMutations()
    flushFrames()
    expect(measure).toHaveBeenCalledTimes(1)
    document.body.appendChild(document.createElement('aside'))
    await settleMutations()
    flushFrames()
    expect(measure).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event('resize'))
    flushFrames()
    expect(measure).toHaveBeenCalledTimes(3)
    document.dispatchEvent(new Event('pointerup'))
    flushFrames()
    expect(measure).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(SETTLE_MS)
    flushFrames()
    expect(measure).toHaveBeenCalledTimes(4)
  })

  it('measures once more after start for a dock a theme script draws late', () => {
    vi.advanceTimersByTime(REMEASURE_MS)
    flushFrames()
    expect(measure).toHaveBeenCalled()
  })
})

describe('plain page chat module', () => {
  it('watches the same things with the same numbers, never the whole body for classes', () => {
    const spec = chatModuleSpec(DEFAULT_INBOX_WIDGET, 'Waimers')
    expect(spec.config).toMatchObject({
      watch: WATCH_SELECTOR,
      settle: SETTLE_MS,
      scrollSettle: SCROLL_SETTLE_MS,
      late: REMEASURE_MS,
    })
    expect(CHAT_MODULE).not.toContain("attributeFilter: ['class', 'open', 'hidden']")
    expect(CHAT_MODULE).not.toContain('transitionend')
    expect(CHAT_MODULE).toContain("{ subtree: true, attributes: true, attributeFilter: ['open'] }")
  })
})
