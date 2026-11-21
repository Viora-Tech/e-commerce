import { afterEach, describe, expect, it, vi } from 'vitest'
import { bottomBars, EDGE_PX, isOverlay, launcherLift, SAMPLE_ROWS } from './launcher-lift'

// A 390x844 phone with the chat button at x 318-374 (the live Glide report).
const VH = 844
const BUTTON = { left: 318, right: 374 }

describe('launcherLift', () => {
  it('is 0 with nothing pinned to the bottom', () => {
    expect(launcherLift([], BUTTON, VH)).toBe(0)
  })

  it('lifts the button above a full-width mobile dock', () => {
    const dock = { top: 780, bottom: 844, left: 0, right: 390 }
    expect(launcherLift([dock], BUTTON, VH)).toBe(64)
  })

  it('takes the tallest of several bars', () => {
    const dock = { top: 780, bottom: 844, left: 0, right: 390 }
    const stickyCart = { top: 700, bottom: 780, left: 0, right: 390 }
    const banner = { top: 640, bottom: 832, left: 12, right: 378 }
    expect(launcherLift([dock, stickyCart, banner], BUTTON, VH)).toBe(204)
  })

  it('counts a bar inset a little from the edge (safe area, a floating banner)', () => {
    const floating = { top: 760, bottom: 820, left: 12, right: 378 }
    expect(launcherLift([floating], BUTTON, VH)).toBe(84)
  })

  it('ignores bars away from the bottom edge', () => {
    const header = { top: 0, bottom: 64, left: 0, right: 390 }
    const midBar = { top: 400, bottom: 460, left: 0, right: 390 }
    expect(launcherLift([header, midBar], BUTTON, VH)).toBe(0)
  })

  it("ignores bars that do not reach the button's column", () => {
    const leftPill = { top: 790, bottom: 834, left: 12, right: 200 }
    expect(launcherLift([leftPill], BUTTON, VH)).toBe(0)
  })

  it('ignores overlays taller than half the window (an open drawer)', () => {
    const drawer = { top: 0, bottom: 844, left: 40, right: 390 }
    expect(launcherLift([drawer], BUTTON, VH)).toBe(0)
  })
})

describe('isOverlay', () => {
  it('tells a drawer from a bar', () => {
    expect(isOverlay({ top: 0, bottom: 844, left: 40, right: 390 }, VH)).toBe(true)
    expect(isOverlay({ top: 780, bottom: 844, left: 0, right: 390 }, VH)).toBe(false)
  })
})

describe('bottomBars', () => {
  // The Revamp dock: fixed, floated var(--rv-gutter) (0.75rem) off the bottom edge, 58 high.
  const dockBox = { top: VH - 12 - 58, bottom: VH - 12, left: 12, right: 378 }

  function stubPage() {
    const dock = {
      closest: () => null,
      parentElement: null,
      getBoundingClientRect: () => dockBox,
    }
    const page = { closest: () => null, parentElement: null }
    vi.stubGlobal('window', { innerHeight: VH })
    vi.stubGlobal('getComputedStyle', (el: unknown) => ({
      position: el === dock ? 'fixed' : 'static',
    }))
    vi.stubGlobal('document', {
      body: {},
      documentElement: {},
      // Only points inside the dock's box hit the dock; below it is the page.
      elementsFromPoint: (_x: number, y: number) =>
        y >= dockBox.top && y <= dockBox.bottom ? [dock] : [page],
    })
  }
  afterEach(() => vi.unstubAllGlobals())

  it('finds a dock floated a little off the bottom edge, so the button lifts over it', () => {
    stubPage()
    const bars = bottomBars(BUTTON)
    expect(bars).toEqual([dockBox])
    expect(launcherLift(bars, BUTTON, VH)).toBe(70)
  })

  it('samples up to EDGE_PX from the edge', () => {
    expect(Math.max(...SAMPLE_ROWS)).toBeLessThanOrEqual(EDGE_PX)
    expect(Math.max(...SAMPLE_ROWS)).toBeGreaterThan(12)
  })
})
